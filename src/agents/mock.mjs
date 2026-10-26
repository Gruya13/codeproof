import { readFileSync } from "node:fs";

function extractFindingId(messages) {
  const text = messages.map(function (message) { return message.content; }).join("\n");
  const quoted = text.match(/"id"\s*:\s*"(F-[0-9]{3})"/);
  if (quoted) return quoted[1];
  const bare = text.match(/F-[0-9]{3}/);
  return bare ? bare[0] : null;
}

export function createMockAgent(options) {
  const scenario = JSON.parse(readFileSync(options.scenarioPath, "utf8"));
  let scannerCallCount = 0;
  function responseCost(response) {
    return response?.costUsd ?? response?.costPerCall ?? scenario.costUsd ?? scenario.costPerCall ?? 0;
  }
  return async function complete(request) {
    if (request.role === "scanner") {
      let text;
      if (Array.isArray(scenario.scannerRaw) && scenario.scannerRaw.length > 0) {
        text = scannerCallCount < scenario.scannerRaw.length
          ? scenario.scannerRaw[scannerCallCount]
          : scenario.scannerRaw[scenario.scannerRaw.length - 1];
        scannerCallCount += 1;
      } else {
        text = JSON.stringify({ findings: scenario.findings });
      }
      return {
        text: text,
        usage: { inputTokens: 1850, outputTokens: 260, cachedTokens: 0 },
        costUsd: responseCost(scenario.scanner),
        model: "mock-scanner",
        latencyMs: 2,
        retries: 0,
        finishReason: "stop",
        httpStatus: 200
      };
    }
    if (request.role === "verifier") {
      const findingId = extractFindingId(request.messages);
      const verdict = scenario.verdicts.find(function (item) { return item.findingId === findingId; });
      const one = verdict || {
        findingId: findingId,
        verdict: "uncertain",
        reason: "mock scenario has no verdict for " + findingId + "; treat as uncertain for the demo."
      };
      return {
        text: JSON.stringify({ verdicts: [one] }),
        usage: { inputTokens: 1400, outputTokens: 140, cachedTokens: 900 },
        costUsd: responseCost(verdict),
        model: "mock-verifier",
        latencyMs: 2,
        retries: 0,
        finishReason: "stop",
        httpStatus: 200
      };
    }
    return {
      text: "",
      usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
      costUsd: responseCost(),
      model: "mock",
      latencyMs: 0,
      retries: 0,
      finishReason: "stop",
      httpStatus: 200
    };
  };
}
