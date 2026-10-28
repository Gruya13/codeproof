// Regression tests for the fixes derived from the real-world sample (v0.2.2):
// P1 - the patcher retries an empty/truncated response instead of losing the L4 proof;
// P2 - the reproducer prompt states the two L0 rules that real-world runs kept violating.
import test from "node:test";
import assert from "node:assert/strict";
import { attemptPatch } from "../src/patch/index.mjs";
import { REPRO_SYSTEM_PROMPT } from "../src/repro/index.mjs";

const finding = {
  id: "F-001",
  title: "sample",
  claim: "the sample claim",
  evidence: [{ path: "lib.js", startLine: 1, endLine: 1, snippet: "const a = 1;" }]
};

function fakeAgent(responses) {
  const calls = [];
  return {
    calls: calls,
    complete: async function (request) {
      calls.push(request);
      const response = responses.shift();
      if (!response) throw new Error("fake agent ran out of responses");
      return {
        model: "fake-patcher",
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 },
        costUsd: 0.001,
        ...response
      };
    }
  };
}

function unsupportedResponse() {
  return JSON.stringify({
    findingId: "F-001",
    kind: "unsupported",
    targetFile: "",
    searchBlock: "",
    replaceBlock: "",
    rationale: "no safe minimal fix can be derived from the excerpt alone",
    unsupportedReason: "the excerpt does not include the validation path this defect depends on"
  });
}

test("attemptPatch retries once with a doubled budget on an empty patch response (P1)", async function () {
  const agent = fakeAgent([
    { text: "", finishReason: "length" },
    { text: unsupportedResponse(), finishReason: "stop", costUsd: 0.002 }
  ]);
  const result = await attemptPatch({ finding: finding, agent: agent, config: {} });
  assert.equal(agent.calls.length, 2);
  assert.equal(agent.calls[1].maxTokens, 12000);
  assert.equal(result.status, "unsupported");
  assert.equal(result.costUsd, 0.003);
});

test("attemptPatch does not retry a non-empty patch response (P1)", async function () {
  const agent = fakeAgent([{ text: unsupportedResponse(), finishReason: "stop" }]);
  const result = await attemptPatch({ finding: finding, agent: agent, config: {} });
  assert.equal(agent.calls.length, 1);
  assert.equal(result.status, "unsupported");
});

test("attemptPatch retries once when the response was truncated (P1)", async function () {
  const agent = fakeAgent([
    { text: "{\"findingId\":\"F-001\",\"kind\":\"patch\",", finishReason: "length" },
    { text: unsupportedResponse(), finishReason: "stop" }
  ]);
  const result = await attemptPatch({ finding: finding, agent: agent, config: {} });
  assert.equal(agent.calls.length, 2);
  assert.equal(result.status, "unsupported");
});

test("reproducer prompt states the different-input rule with a concrete example (P2)", function () {
  assert.match(REPRO_SYSTEM_PROMPT, /do not repeat the same arguments in both files/);
  assert.match(REPRO_SYSTEM_PROMPT, /Example of a valid pair/);
  assert.match(REPRO_SYSTEM_PROMPT, /asserts a constant/);
});

test("reproducer prompt states that an unsupported response has no code (P2)", function () {
  assert.match(REPRO_SYSTEM_PROMPT, /must have empty testCode and empty controlCode/);
});
