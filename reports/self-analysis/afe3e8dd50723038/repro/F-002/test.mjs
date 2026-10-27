import assert from "node:assert/strict";
import { costOf } from "./config.mjs";

// Unknown-model usage must not be free: it must be charged to the budget
// (spentUsd increases and/or exceeded trips) or fail closed with an error.
let cost = null;
let costError = null;
try {
  cost = costOf("unknown-model-xyz", { inputTokens: 1000000, outputTokens: 1000000, cachedTokens: 0 });
} catch (error) {
  costError = error;
}
let budget = null;
let chargeError = null;
try {
  const run = await import("./run/index.mjs");
  const Budget = run.Budget ?? Object.values(run).find((v) => typeof v === "function" && v.prototype && typeof v.prototype.charge === "function");
  if (Budget) {
    for (const args of [[0.01], [0.01, true], [{ limitUsd: 0.01, budgetUsd: 0.01, hardBudget: true }]]) {
      try {
        const candidate = new Budget(...args);
        if (candidate && typeof candidate.charge === "function" && "spentUsd" in candidate) { budget = candidate; break; }
      } catch {}
    }
  }
  if (budget) {
    try { budget.charge(cost); } catch (error) { chargeError = error; }
  }
} catch {}
const charged = budget ? budget.spentUsd > 0 || budget.exceeded === true : typeof cost === "number" && cost > 0;
assert.equal(costError !== null || chargeError !== null || charged, true, `unknown model bypassed budget: cost=${cost} spentUsd=${budget?.spentUsd} exceeded=${budget?.exceeded}`);
