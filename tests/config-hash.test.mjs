import test from "node:test";
import assert from "node:assert/strict";
import { computeConfigSha256 } from "../src/config.mjs";

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

test("config-hash: changing mode changes configSha256", function () {
  const hashDemo = computeConfigSha256(baseConfig, "demo");
  const hashBench = computeConfigSha256(baseConfig, "bench");
  assert.notEqual(hashDemo, hashBench);
});
