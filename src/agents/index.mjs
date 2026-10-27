import { createMetaAgent } from "./meta.mjs";
import { createMockAgent } from "./mock.mjs";
import { estimateCost } from "../config.mjs";

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
    if (role === "scanner") return options.scannerModel;
    if (role === "scanner-secondary") return options.secondaryScannerModel || options.scannerModel;
    if (role === "verifier-secondary") return options.secondaryVerifierModel || options.scannerModel;
    if (role === "repro") return options.reproModel || options.verifierModel;
    return options.verifierModel;
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

  const byRole = {
    scanner: createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.scannerModel,
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    }),
    verifier: createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.verifierModel,
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    }),
    repro: createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.reproModel || options.verifierModel,
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    }),
    "scanner-secondary": createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.secondaryScannerModel || options.verifierModel,
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    }),
    "verifier-secondary": createMetaAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.secondaryVerifierModel || options.scannerModel,
      maxRetries: options.maxRetries,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    })
  };
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
