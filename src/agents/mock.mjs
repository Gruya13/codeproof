import { readFileSync } from "node:fs";

function extractFindingId(messages) {
  const text = messages.map(function (message) { return message.content; }).join("\n");
  const quoted = text.match(/"id"\s*:\s*"(F-[0-9]{3})"/);
  if (quoted) return quoted[1];
  const bare = text.match(/F-[0-9]{3}/);
  return bare ? bare[0] : null;
}

// Canned two-phase reproducer for the demo fixture. Only F-001 has an executable proof: the other
// demo findings have no deterministic local reproducer, so they stay unsupported and are reported
// as such - the mock pipeline never fabricates a result.
const CONTROL_CODE = [
  "import assert from 'node:assert/strict';",
  "import { page } from './src/pagination.js';",
  "",
  "const empty = page([], 0, 2);",
  "assert.deepEqual(empty, []);"
].join("\n") + "\n";
const TRIGGER_CODE = [
  "import assert from 'node:assert/strict';",
  "import { page } from './src/pagination.js';",
  "",
  "const firstPage = page([1, 2, 3, 4, 5], 0, 2);",
  "assert.deepEqual(firstPage, [1, 2]);"
].join("\n") + "\n";

export function mockDemoReproducer(findingId) {
  if (findingId === "F-001") {
    return {
      findingId: findingId,
      kind: "test",
      controlCode: CONTROL_CODE,
      testCode: TRIGGER_CODE,
      expectedBehavior: "page returns exactly size items for a full page",
      rationale: "the control proves the API call is valid, the trigger exposes the extra item",
      unsupportedReason: ""
    };
  }
  return {
    findingId: findingId,
    kind: "unsupported",
    controlCode: "",
    testCode: "",
    expectedBehavior: "no deterministic local reproducer for this demo finding",
    rationale: "the demo fixture only ships an executable reproducer for the pagination defect",
    unsupportedReason: "mock pipeline: no executable reproducer for " + findingId
  };
}

// Canned patch for the demo defect: remove the off-by-one slice end. The patch is applied to a
// copy of the snapshot and the differential gate runs the real control and trigger.
export function mockDemoPatch(findingId) {
  if (findingId === "F-001") {
    return {
      findingId: findingId,
      kind: "patch",
      targetFile: "src/pagination.js",
      searchBlock: "  return items.slice(start, start + size + 1);",
      replaceBlock: "  return items.slice(start, start + size);",
      rationale: "the slice end is exclusive, so the extra +1 makes the page leak one item",
      unsupportedReason: ""
    };
  }
  return {
    findingId: findingId,
    kind: "unsupported",
    targetFile: "",
    searchBlock: "",
    replaceBlock: "",
    rationale: "the demo fixture only ships a canned patch for the pagination defect",
    unsupportedReason: "mock pipeline: no canned patch for " + findingId
  };
}

export function createMockAgent(options) {
  const scenario = JSON.parse(readFileSync(options.scenarioPath, "utf8"));
  let scannerCallCount = 0;
  function responseCost(response) {
    return response?.costUsd ?? response?.costPerCall ?? scenario.costUsd ?? scenario.costPerCall ?? 0;
  }
  return async function complete(request) {
    if (request.role === "scanner" || request.role === "scanner-secondary") {
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
    if (request.role === "verifier" || request.role === "verifier-secondary") {
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
    if (request.role === "repro") {
      const reproFindingId = extractFindingId(request.messages) || "F-001";
      // The demo fixture has one defect that can be proven by execution: the off-by-one page
      // slice in fixtures/mini-repo/src/pagination.js. The control passes every run, the trigger
      // fails every run, and the CLI executes both for real - the mock adapter supplies code, never results.
      const demo = mockDemoReproducer(reproFindingId);
      return {
        text: JSON.stringify(demo),
        usage: { inputTokens: 1200, outputTokens: 220, cachedTokens: 800 },
        costUsd: responseCost(),
        model: "mock-repro",
        latencyMs: 2,
        retries: 0,
        finishReason: "stop",
        httpStatus: 200
      };
    }
    if (request.role === "patcher") {
      const patchFindingId = extractFindingId(request.messages) || "F-001";
      return {
        text: JSON.stringify(mockDemoPatch(patchFindingId)),
        usage: { inputTokens: 1100, outputTokens: 180, cachedTokens: 700 },
        costUsd: responseCost(),
        model: "mock-patcher",
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
