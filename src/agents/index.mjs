import { createMetaAgent } from "./meta.mjs";
import { createMockAgent } from "./mock.mjs";
import { estimateCost } from "../config.mjs";

// The model that will actually be called for a role. Both the hard-budget preflight and the agent
// construction must use this function: a different fallback in either place prices one model and
// calls another (found by the v0.2.0 self-analysis run, F-003/F-002).
export function roleModel(options, role) {
  if (role === "scanner") return options.scannerModel;
  if (role === "scanner-secondary") return options.secondaryScannerModel || options.verifierModel;
  if (role === "verifier-secondary") return options.secondaryVerifierModel || options.scannerModel;
  if (role === "patcher") return options.patchModel || options.verifierModel;
  if (role === "repro") return options.reproModel || options.verifierModel;
  return options.verifierModel;
}

// Usage buckets are keyed by the role that actually ran. Reporting every non-scanner role as
// "verifier" (the v0.2.0 behaviour) hid patcher and secondary-scanner calls and merged their models.
const USAGE_ROLE_LABEL = {
  scanner: "scanner-correctness",
  verifier: "verifier",
  "verifier-secondary": "verifier-secondary",
  "scanner-secondary": "scanner-secondary",
  repro: "repro",
  patcher: "patcher"
};

export function aggregateUsage(callLog, options) {
  const mock = Boolean(options && options.mock);
  const byRoleMap = new Map();
  for (const call of callLog) {
    const role = USAGE_ROLE_LABEL[call.role] || call.role;
    if (!byRoleMap.has(role)) {
      byRoleMap.set(role, { role: role, model: call.model, calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: mock ? null : 0 });
    }
    const aggregate = byRoleMap.get(role);
    aggregate.calls += 1;
    aggregate.inputTokens += call.inputTokens;
    aggregate.outputTokens += call.outputTokens;
    aggregate.cachedTokens += call.cachedTokens;
    if (!mock && call.costUsd !== null) aggregate.costUsd += call.costUsd;
  }
  return Array.from(byRoleMap.values());
}

export function createAgents(options) {
  const callLog = [];
  const budget = options.budget;
  let counter = 0;

  function budgetExceededError() {
    const error = new Error("run budget exceeded: spent " + budget.spentUsd + " USD of " + budget.limitUsd);
    error.code = "BUDGET_EXCEEDED";
    return error;
  }

  // The hard gate refuses a request BEFORE it is sent when its worst-case price does not fit
  // into the remaining budget. Input tokens are estimated conservatively (3 chars per token,
  // no cache hits) and the output budget is the request max_tokens, so the estimate is an upper
  // bound. A false rejection only costs a finding; a false acceptance would break the cap.
  function estimateRequestCost(model, request) {
    if (!model) return 0;
    const messageChars = (request.messages || []).reduce(function (sum, message) {
      return sum + String(message && message.content ? message.content : "").length;
    }, 0);
    const formatChars = request.responseFormat ? JSON.stringify(request.responseFormat).length : 0;
    const inputTokens = Math.ceil((messageChars + formatChars) / 3);
    const outputTokens = Number(request.maxTokens) > 0 ? Number(request.maxTokens) : 4000;
    return estimateCost(model, inputTokens, outputTokens);
  }

  function hardBudgetError(estimated, model) {
    const detail = estimated === null || estimated === undefined
      ? "the price of model " + model + " is unknown"
      : "the next call on " + model + " could cost up to " + estimated.toFixed(4) + " USD, which does not fit into the remaining " + Math.max(0, budget.limitUsd - budget.spentUsd).toFixed(4) + " USD";
    const error = new Error("hard budget: " + detail);
    error.code = "BUDGET_EXCEEDED";
    return error;
  }

  function modelForRole(role) {
    return roleModel(options, role);
  }

  function record(role, result) {
    if (!options.mock && (result.costUsd === null || result.costUsd === undefined)) {
      const error = new Error("the price of model " + result.model + " is unknown; refusing to run with an unmeasured budget");
      error.code = "UNKNOWN_PRICE";
      throw error;
    }
    callLog.push({
      role: role,
      model: result.model,
      index: counter,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cachedTokens,
      costUsd: result.costUsd,
      durationMs: result.latencyMs,
      retries: result.retries || 0,
      finishReason: result.finishReason || null,
      httpStatus: result.httpStatus || null
    });
    counter += 1;
    budget.charge(result.costUsd);
    return result;
  }

  if (options.mock) {
    const complete = createMockAgent({ scenarioPath: options.scenarioPath });
    return {
      kind: "mock",
      callLog: callLog,
      complete: function (request) {
        if (budget.exceeded) return Promise.reject(budgetExceededError());
        return complete(request).then(function (result) { return record(request.role, result); });
      }
    };
  }

  // Construction goes through roleModel too, so the preflight estimate and the executed model
  // can never diverge again.
  const byRole = {};
  for (const role of ["scanner", "verifier", "repro", "patcher", "scanner-secondary", "verifier-secondary"]) {
    byRole[role] = createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: roleModel(options, role),
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    });
  }
  return {
    kind: "meta",
    callLog: callLog,
    complete: function (request) {
      if (budget.exceeded) return Promise.reject(budgetExceededError());
      if (options.hardBudget) {
        const model = modelForRole(request.role);
        const estimate = estimateRequestCost(model, request);
        if (!budget.canAfford(estimate)) return Promise.reject(hardBudgetError(estimate, model));
      }
      return byRole[request.role](request).then(function (result) { return record(request.role, result); });
    }
  };
}
