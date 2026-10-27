import assert from "node:assert/strict";
import { estimateCost, costOf } from "./config.mjs";

// Sanity: a known model has a positive worst-case estimate.
assert.ok(estimateCost("muse-spark-1.3", 1000, 1000) > 0);
// Existing contract in the same file: costOf signals unknown models with null, not $0.
assert.equal(costOf("no-such-model", { inputTokens: 1000, cachedTokens: 0, outputTokens: 1000 }), null);

let est;
let thrown = null;
try {
  est = estimateCost("no-such-model", 1000000, 1000000);
} catch (e) {
  thrown = e;
}
// Unknown model must not produce a $0 worst-case that canAfford() always passes:
// it must signal unknown (null), be positive/Infinity, or fail safe by throwing.
assert.ok(
  thrown !== null || est === null || est === Infinity || (typeof est === "number" && est > 0),
  `unknown model must not be free: estimateCost returned ${String(est)}`
);
assert.notEqual(est, 0);
