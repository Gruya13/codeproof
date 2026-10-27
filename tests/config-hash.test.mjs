import test from "node:test";
import assert from "node:assert/strict";
import { computeConfigSha256, estimateCost, loadConfig } from "../src/config.mjs";

const baseConfig = {
  scannerModel: "muse-spark-1.3",
  verifierModel: "muse-wonder-1.0",
  temperature: 0,
  maxFindings: 8,
  citationMaxLines: 15,
  scannerMaxTokens: 16000,
  verifierMaxTokens: 4000,
  verifierContextChars: 24000,
  budgetUsd: 2.0
};

test("config-hash: identical configuration and mode yields identical hash", function () {
  const hash1 = computeConfigSha256(baseConfig, "demo");
  const hash2 = computeConfigSha256({ ...baseConfig }, "demo");
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test("config-hash: changing MAX_FINDINGS changes configSha256", function () {
  const hash1 = computeConfigSha256(baseConfig, "demo");
  const hash2 = computeConfigSha256({ ...baseConfig, maxFindings: 12 }, "demo");
  assert.notEqual(hash1, hash2);
});

test("config-hash: changing BUDGET_USD does NOT change configSha256", function () {
  const hash1 = computeConfigSha256(baseConfig, "demo");
  const hash2 = computeConfigSha256({ ...baseConfig, budgetUsd: 10.0 }, "demo");
  assert.equal(hash1, hash2);
});

test("config-hash: changing VERIFIER_CONTEXT_CHARS changes configSha256", function () {
  const hash1 = computeConfigSha256(baseConfig, "demo");
  const hash2 = computeConfigSha256({ ...baseConfig, verifierContextChars: 12000 }, "demo");
  assert.notEqual(hash1, hash2);
});

test("config-hash: dual-scan mode and its secondary model are part of the run identity", function () {
  assert.equal(loadConfig({}).dualScan, false);
  assert.equal(loadConfig({ DUAL_SCAN: "1" }).dualScan, true);
  assert.equal(loadConfig({ DUAL_SCAN: "1", SECONDARY_SCANNER_MODEL: "muse-spark-1.2" }).secondaryScannerModel, "muse-spark-1.2");
  const off = computeConfigSha256({ ...baseConfig, dualScan: false }, "smoke");
  const on = computeConfigSha256({ ...baseConfig, dualScan: true, secondaryScannerModel: "muse-wonder-1.0" }, "smoke");
  assert.notEqual(off, on);
});

test("config-hash: the hard-budget gate is part of the run identity", function () {
  const hash1 = computeConfigSha256({ ...baseConfig, hardBudget: true }, "demo");
  const hash2 = computeConfigSha256({ ...baseConfig, hardBudget: false }, "demo");
  assert.notEqual(hash1, hash2);
  assert.equal(loadConfig({}).hardBudget, true);
  assert.equal(loadConfig({ HARD_BUDGET: "0" }).hardBudget, false);
});

test("T-C15: SCANNER_MAX_TOKENS is read from the environment and changes the run identity", function () {
  assert.equal(loadConfig({}).scannerMaxTokens, 16000);
  assert.equal(loadConfig({ SCANNER_MAX_TOKENS: "32000" }).scannerMaxTokens, 32000);
  assert.equal(loadConfig({ VERIFIER_MAX_TOKENS: "8000" }).verifierMaxTokens, 8000);
  const hash1 = computeConfigSha256({ ...baseConfig, scannerMaxTokens: 16000 }, "smoke");
  const hash2 = computeConfigSha256({ ...baseConfig, scannerMaxTokens: 32000 }, "smoke");
  assert.notEqual(hash1, hash2);
});

test("estimateCost is a worst-case upper bound with no cache discount", function () {
  // 1M input tokens on Spark 1.3 cost 1.25 USD; 1M output tokens cost 4.25 USD.
  assert.equal(estimateCost("muse-spark-1.3", 1_000_000, 0), 1.25);
  assert.equal(estimateCost("muse-spark-1.3", 0, 1_000_000), 4.25);
  assert.equal(estimateCost("unknown-model", 1000, 1000), null, "an unknown price must not be treated as free");
  assert.ok(estimateCost("muse-wonder-1.0", 1000, 1000) > estimateCost("muse-spark-1.3", 1000, 1000));
});

test("config-hash: changing mode changes configSha256", function () {
  const hashDemo = computeConfigSha256(baseConfig, "demo");
  const hashBench = computeConfigSha256(baseConfig, "bench");
  assert.notEqual(hashDemo, hashBench);
});
