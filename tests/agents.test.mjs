import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgents } from "../src/agents/index.mjs";
import { Budget } from "../src/run/index.mjs";

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: function () { return "0"; } },
    json: function () { return Promise.resolve(payload); },
    text: function () { return Promise.resolve(""); }
  };
}

function chatResponse(text) {
  return jsonResponse({
    choices: [{ message: { content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 0 } }
  });
}

function makeAgents(overrides) {
  const calls = [];
  const options = {
    mock: false,
    scenarioPath: "",
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    scannerModel: "muse-spark-1.3",
    verifierModel: "muse-wonder-1.0",
    reproModel: "muse-wonder-1.0",
    maxRetries: 0,
    hardBudget: false,
    budget: new Budget(2),
    fetchImpl: function (url, request) {
      calls.push({ url: url, body: JSON.parse(request.body) });
      return Promise.resolve(chatResponse("{\"ok\":true}"));
    }
  };
  const merged = { ...options, ...(overrides || {}) };
  const agents = createAgents(merged);
  return { agents, calls, budget: merged.budget, fetchImpl: merged.fetchImpl };
}

test("agents: meta mode records role, model, usage and cost and charges the budget", async function () {
  const { agents, calls, budget } = makeAgents();
  const result = await agents.complete({ role: "scanner", messages: [{ role: "user", content: "hello" }], maxTokens: 100 });
  assert.equal(result.text, "{\"ok\":true}");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, "muse-spark-1.3");
  assert.equal(agents.callLog.length, 1);
  assert.equal(agents.callLog[0].role, "scanner");
  assert.equal(agents.callLog[0].model, "muse-spark-1.3");
  assert.equal(agents.callLog[0].inputTokens, 100);
  assert.equal(agents.callLog[0].outputTokens, 20);
  assert.equal(agents.callLog[0].finishReason, "stop");
  assert.equal(budget.calls, 1);
  assert.ok(budget.spentUsd > 0, "budget must be charged");
});

test("agents: each role uses its configured model", async function () {
  const { agents, calls } = makeAgents();
  for (const role of ["scanner", "verifier", "repro"]) {
    await agents.complete({ role: role, messages: [{ role: "user", content: role }], maxTokens: 100 });
  }
  assert.deepEqual(calls.map(function (call) { return call.body.model; }), ["muse-spark-1.3", "muse-wonder-1.0", "muse-wonder-1.0"]);
  assert.deepEqual(agents.callLog.map(function (call) { return call.role; }), ["scanner", "verifier", "repro"]);
});

test("agents: the soft budget refuses the call after the limit is exceeded", async function () {
  const budget = new Budget(0);
  const { agents, calls } = makeAgents({ budget: budget, hardBudget: false });
  await agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10 });
  assert.equal(calls.length, 1);
  await assert.rejects(agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10 }), function (error) {
    return error.code === "BUDGET_EXCEEDED";
  });
  assert.equal(calls.length, 1, "the second call must not reach the network");
});

test("agents: the hard budget refuses before sending when the worst case does not fit", async function () {
  const budget = new Budget(0.0001);
  const { agents, calls } = makeAgents({ budget: budget, hardBudget: true });
  await assert.rejects(agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10000 }), function (error) {
    return error.code === "BUDGET_EXCEEDED" && /hard budget/.test(error.message);
  });
  assert.equal(calls.length, 0, "the hard gate must reject before the network call");
  assert.equal(budget.spentUsd, 0);
});

test("agents: the hard budget allows a call that fits", async function () {
  const { agents, calls } = makeAgents({ budget: new Budget(2), hardBudget: true });
  const result = await agents.complete({ role: "verifier", messages: [{ role: "user", content: "x" }], maxTokens: 100 });
  assert.equal(result.text, "{\"ok\":true}");
  assert.equal(calls.length, 1);
});

test("agents: an unknown model price fails closed at the hard gate and at accounting", async function () {
  // hard gate: the estimate is null, so the call is refused before the network
  const hard = makeAgents({ scannerModel: "unknown-model-9", hardBudget: true });
  await assert.rejects(hard.agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10 }), function (error) {
    return error.code === "BUDGET_EXCEEDED" && /price of model/.test(error.message);
  });
  assert.equal(hard.calls.length, 0, "an unknown price must be refused before spending");
  // accounting without the hard gate: a null cost is not silently ignored
  const soft = makeAgents({ scannerModel: "unknown-model-9", hardBudget: false });
  await assert.rejects(soft.agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10 }), function (error) {
    return error.code === "UNKNOWN_PRICE";
  });
});

test("agents: mock mode returns the scenario and still records the call", async function (t) {
  const dir = mkdtempSync(join(tmpdir(), "agents-mock-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  const scenarioPath = join(dir, "mock-scenario.json");
  writeFileSync(scenarioPath, JSON.stringify({ findings: [], verdicts: [], costUsd: 0 }), "utf8");
  const budget = new Budget(2);
  const agents = createAgents({ mock: true, scenarioPath: scenarioPath, budget: budget, hardBudget: false });
  const result = await agents.complete({ role: "scanner", messages: [{ role: "user", content: "x" }], maxTokens: 10 });
  assert.deepEqual(JSON.parse(result.text), { findings: [] });
  assert.equal(agents.callLog.length, 1);
  assert.equal(agents.callLog[0].model, "mock-scanner");
  assert.equal(budget.calls, 1);
});