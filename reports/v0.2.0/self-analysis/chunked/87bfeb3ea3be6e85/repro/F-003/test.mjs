import assert from "node:assert/strict";
import { createAgents } from "./agents/index.mjs";
const budget = { spentUsd: 0, limitUsd: 1, exceeded: false, canAfford: () => false, charge: () => {} };
const agents = createAgents({
  apiKey: "k",
  baseUrl: "https://example.invalid",
  scannerModel: "test-scanner-model",
  verifierModel: "test-verifier-model",
  hardBudget: true,
  budget,
  fetchImpl: async () => { throw new Error("fetch should not run"); },
  sleepImpl: async () => {}
});
assert.equal(agents.kind, "meta");
let error = null;
try {
  await agents.complete({ role: "scanner-secondary", messages: [{ content: "hello" }], maxTokens: 10 });
} catch (e) { error = e; }
assert.ok(error);
assert.equal(error.code, "BUDGET_EXCEEDED");
assert.ok(error.message.includes("test-verifier-model"));
