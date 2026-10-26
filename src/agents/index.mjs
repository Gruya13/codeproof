import { createMetaAgent } from "./meta.mjs";
import { createMockAgent } from "./mock.mjs";

export function createAgents(options) {
  const callLog = [];
  const budget = options.budget;
  let counter = 0;

  function budgetExceededError() {
    const error = new Error("run budget exceeded: spent " + budget.spentUsd + " USD of " + budget.limitUsd);
    error.code = "BUDGET_EXCEEDED";
    return error;
  }

  function record(role, result) {
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
    })
  };
  return {
    kind: "meta",
    callLog: callLog,
    complete: function (request) {
      if (budget.exceeded) return Promise.reject(budgetExceededError());
      return byRole[request.role](request).then(function (result) { return record(request.role, result); });
    }
  };
}
