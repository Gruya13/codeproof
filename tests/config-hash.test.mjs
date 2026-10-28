import test from "node:test";
import assert from "node:assert/strict";
import { computeConfigSha256, configPayload, estimateCost, loadConfig } from "../src/config.mjs";

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

test("config-hash: v1 payload is byte-identical to the pre-v0.2.0 payload (measured constants)", function () {
  const cases = [
    { env: {}, mode: "demo", hash: "b5daee87e47ce05a9100cdd918a53687ea8a640532e997ab7acf93608cee72a6" },
    { env: {}, mode: "smoke", hash: "e70ebcddabb25e4fa09ff98e977c72407aebc28c82e8f47448bc085fe44b4e42" },
    { env: {}, mode: "bench", hash: "634ea8d012279218ce761247566601f0b63e67fb86662fd9760cb6c3717e9e3f" },
    { env: { USE_MOCK: "1" }, mode: "demo", hash: "4b72cb985745f31ee81820308203c2f60067c3aaed8517c1fbaa6cd18f2050a5" },
    { env: { MAX_FINDINGS: "12" }, mode: "bench", hash: "9c20dcc4aeb48f597251eb21dc110b56ca6516d489f5b80b58a46e790e68fd6d" }
  ];
  for (const item of cases) {
    assert.equal(computeConfigSha256(loadConfig(item.env), item.mode), item.hash, "v1 hash changed for " + JSON.stringify(item.env) + " mode " + item.mode);
  }
});

test("config-hash: v2 payload is additive and carries the v0.2.0 fields", function () {
  const config = loadConfig({});
  const v1 = computeConfigSha256(config, "smoke");
  const v2 = computeConfigSha256(config, "smoke", { version: 2 });
  assert.notEqual(v1, v2, "v2 payload must differ from v1");
  assert.equal(v2, computeConfigSha256(loadConfig({}), "smoke", { version: 2 }), "v2 is deterministic");
  const payload = configPayload(config, "smoke", { version: 2 });
  assert.equal(payload.mode, "smoke");
  assert.equal(payload.patchEnabled, true);
  assert.equal(payload.patchModel, "muse-wonder-1.0");
  assert.equal(payload.patchMaxTokens, 6000);
  assert.equal(payload.patchMaxCandidates, 3);
  assert.equal(payload.verifyEscalate, false);
  assert.equal(payload.mockPipeline, false);
  assert.equal(configPayload(config, "smoke", { version: 1 }).patchEnabled, undefined, "v1 payload must not include v0.2.0 fields");
  assert.notEqual(v2, computeConfigSha256(loadConfig({ PATCH_MODEL: "muse-spark-1.3" }), "smoke", { version: 2 }), "PATCH_MODEL is part of the v2 identity");
  assert.notEqual(v2, computeConfigSha256(loadConfig({ PATCH_MAX_CANDIDATES: "5" }), "smoke", { version: 2 }));
  assert.notEqual(v2, computeConfigSha256(loadConfig({ VERIFY_ESCALATE: "1" }), "smoke", { version: 2 }));
});

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
  assert.equal(loadConfig({}).dualScanMaxLoc, 0, "the secondary-scan LOC guard is off by default");
  assert.equal(loadConfig({ DUAL_SCAN_MAX_LOC: "2500" }).dualScanMaxLoc, 2500);
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
