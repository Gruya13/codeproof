// Regression tests for defects found by CodeProof on its own src/ (v0.2.0 self-analysis runs).
// Each test corresponds to a finding; the finding id and run are noted in the test name.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPatchToSnapshot, unifiedDiff } from "../src/patch/index.mjs";
import { aggregateUsage, roleModel } from "../src/agents/index.mjs";
import { checkCitation } from "../src/verify/index.mjs";
import { loadConfig } from "../src/config.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("unifiedDiff: append-only change emits no undefined lines (self-analysis F-001/F-008)", function () {
  const diff = unifiedDiff("alpha\nbeta", "alpha\nbeta\ngamma", { label: "sample" });
  assert.equal(diff.includes("undefined"), false);
  assert.ok(diff.includes("+gamma"));
  assert.equal(diff.includes("-alpha"), false);
  assert.equal(diff.includes("-beta"), false);
  assert.equal(diff.includes("+alpha"), false);
  assert.equal(diff.includes("+beta"), false);
  assert.ok(diff.includes("@@ -2,0 +3,1 @@"));
});

test("unifiedDiff: prepend-only change uses a zero-length before range", function () {
  const diff = unifiedDiff("beta", "alpha\nbeta", { label: "sample" });
  assert.equal(diff.includes("undefined"), false);
  assert.ok(diff.includes("+alpha"));
  assert.equal(diff.includes("-beta"), false);
  assert.ok(diff.includes("@@ -0,0 +1,1 @@"));
});

test("unifiedDiff: replacement still records both sides and an identical input yields no diff", function () {
  const diff = unifiedDiff("alpha\nbeta", "alpha\ngamma", { label: "sample" });
  assert.ok(diff.includes("-beta"));
  assert.ok(diff.includes("+gamma"));
  assert.ok(diff.includes("@@ -2,1 +2,1 @@"));
  assert.equal(unifiedDiff("a\nb", "a\nb", { label: "sample" }), "");
});

test("applyPatchToSnapshot: replacement string is literal, dollar patterns are not expanded (F-009)", function (t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-self-fixes-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  writeFileSync(join(dir, "lib.js"), "const value = 1;\n");
  const result = applyPatchToSnapshot({ snapshotDir: dir, targetFile: "lib.js", searchBlock: "const value = 1;", replaceBlock: "const value = \"$&\";" });
  assert.equal(result.after, "const value = \"$&\";\n");
  assert.equal(readFileSync(join(dir, "lib.js"), "utf8"), "const value = \"$&\";\n");
});

test("roleModel: scanner-secondary falls back to the verifier model in estimate and execution (F-002/F-003)", function () {
  const base = { scannerModel: "spark", verifierModel: "wonder", reproModel: "wonder", patchModel: "wonder" };
  assert.equal(roleModel(base, "scanner-secondary"), "wonder");
  assert.equal(roleModel({ ...base, secondaryScannerModel: "explicit" }, "scanner-secondary"), "explicit");
  assert.equal(roleModel(base, "scanner"), "spark");
  assert.equal(roleModel(base, "verifier"), "wonder");
  assert.equal(roleModel(base, "patcher"), "wonder");
  assert.equal(roleModel(base, "repro"), "wonder");
  assert.equal(roleModel(base, "verifier-secondary"), "spark");
});

test("aggregateUsage: patcher and scanner-secondary calls get their own buckets (F-001/F-003)", function () {
  const callLog = [
    { role: "scanner", model: "spark", inputTokens: 10, outputTokens: 5, cachedTokens: 0, costUsd: 0.01 },
    { role: "verifier", model: "wonder", inputTokens: 20, outputTokens: 10, cachedTokens: 0, costUsd: 0.02 },
    { role: "patcher", model: "wonder", inputTokens: 30, outputTokens: 15, cachedTokens: 0, costUsd: 0.03 },
    { role: "scanner-secondary", model: "wonder", inputTokens: 40, outputTokens: 20, cachedTokens: 0, costUsd: 0.04 }
  ];
  const buckets = aggregateUsage(callLog, { mock: false });
  const byName = new Map(buckets.map(function (bucket) { return [bucket.role, bucket]; }));
  assert.deepEqual([...byName.keys()], ["scanner-correctness", "verifier", "patcher", "scanner-secondary"]);
  assert.equal(byName.get("patcher").calls, 1);
  assert.equal(byName.get("patcher").costUsd, 0.03);
  assert.equal(byName.get("scanner-secondary").calls, 1);
  const mockBuckets = aggregateUsage(callLog, { mock: true });
  assert.equal(mockBuckets.every(function (bucket) { return bucket.costUsd === null; }), true);
});

test("mockPipeline: mock mode enables L3 and run.json records repro.enabled (scanner finding)", function (t) {
  const config = loadConfig({ USE_MOCK: "1" });
  assert.equal(config.mockPipeline, true);
  assert.equal(loadConfig({}).mockPipeline, false);
  const outDir = mkdtempSync(join(tmpdir(), "codeproof-self-fixes-mock-"));
  t.after(function () { rmSync(outDir, { recursive: true, force: true }); });
  execFileSync(process.execPath, [join(repoRoot, "src", "cli.mjs"), "analyze", "fixtures/mini-repo", "--mock", "--out", outDir], {
    cwd: repoRoot,
    env: { ...process.env, USE_MOCK: "1" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const runDir = readdirSync(outDir).find(function (name) { return existsSync(join(outDir, name, "run.json")); });
  assert.ok(runDir, "mock analysis wrote a run directory");
  const run = JSON.parse(readFileSync(join(outDir, runDir, "run.json"), "utf8"));
  assert.equal(run.repro.enabled, true);
  assert.equal(run.patch.enabled, true);
});

test("checkCitation: an unreadable cited file is a failed citation, not a crash (F-011)", function (t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-self-fixes-cite-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  const repo = { root: dir, manifest: new Map([["missing.js", { path: "missing.js", loc: 1 }]]), commit: null };
  const result = checkCitation({ path: "missing.js", startLine: 1, endLine: 1, snippet: "const a = 1;" }, repo);
  assert.equal(result.passed, false);
  assert.match(result.reason, /cannot be read/);
});
