import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadConfig, configPayload, computeConfigSha256 } from "../src/config.mjs";
import { computeRunId } from "../src/run/index.mjs";
import { mergeScannerRuns } from "../src/scan/merge.mjs";
import { scannerSystemPrompt } from "../src/scan/index.mjs";
import { VERIFIER_SYSTEM_PROMPT } from "../src/verify/index.mjs";
import { REPRO_SYSTEM_PROMPT } from "../src/repro/index.mjs";
import { PATCH_SYSTEM_PROMPT } from "../src/patch/index.mjs";
import { buildReport } from "../src/synthesize/index.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingest } from "../src/ingest/index.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function tempDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function finding(id, claim) {
  return { id, title: "Finding " + id, claim, severity: "high",
    evidence: [{ path: "src/page.js", startLine: 12, endLine: 12, snippet: "return items.slice(start, end);" }] };
}

test("D1 keeps different defects on the same line and preserves each proposer", function () {
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [finding("F-001", "The page includes one item beyond the requested end."), finding("F-002", "The page mutates the input array in place.")] },
    { proposedBy: "wonder", findings: [finding("F-001", "Page includes an extra item past the requested end.")] }
  ]);
  assert.equal(merged.candidates.length, 2);
  assert.deepEqual(merged.candidates.map(function (entry) { return entry.proposedBy; }), [["spark", "wonder"], ["spark"]]);
  assert.equal(merged.duplicates.length, 1);
  assert.equal(merged.duplicates[0].originalId, "F-001");
});

test("D3 v2 identity includes endpoint, budget and the actual L0-L4 prompts", function () {
  const config = loadConfig({});
  const hash = function (value) { return createHash("sha256").update(value).digest("hex"); };
  const payload = configPayload(config, "smoke", { version: 2 });
  assert.equal(payload.baseUrl, config.baseUrl);
  assert.equal(payload.budgetUsd, config.budgetUsd);
  assert.deepEqual(payload.promptSha256, {
    scanner: hash(scannerSystemPrompt(config.maxFindings)),
    verifier: hash(VERIFIER_SYSTEM_PROMPT),
    repro: hash(REPRO_SYSTEM_PROMPT),
    patch: hash(PATCH_SYSTEM_PROMPT)
  });
  const configHash = computeConfigSha256(config, "smoke", { version: 2 });
  assert.equal(configHash, computeConfigSha256(loadConfig({}), "smoke", { version: 2 }));
  const urlHash = computeConfigSha256(loadConfig({ META_BASE_URL: "https://other.invalid/v1" }), "smoke", { version: 2 });
  const budgetHash = computeConfigSha256(loadConfig({ BUDGET_USD: "3" }), "smoke", { version: 2 });
  const retryHash = computeConfigSha256(loadConfig({ MAX_RETRIES: "5" }), "smoke", { version: 2 });
  assert.notEqual(urlHash, configHash);
  assert.notEqual(budgetHash, configHash);
  assert.notEqual(retryHash, configHash);
  const runId = function (configSha256) { return computeRunId({ commit: "abc", configSha256, models: ["scanner", "verifier"], prompts: [] }); };
  assert.notEqual(runId(urlHash), runId(configHash));
  assert.notEqual(runId(budgetHash), runId(configHash));
  assert.equal(configPayload(config, "smoke", { version: 1 }).promptSha256, undefined);
});

test("D5 rejects invalid numeric environment values and preserves valid defaults", function () {
  for (const [name, value] of [
    ["BUDGET_USD", "abc"], ["MAX_FINDINGS", "-1"], ["MAX_FINDINGS", "0"],
    ["SCANNER_MAX_TOKENS", "Infinity"], ["VERIFIER_MAX_TOKENS", "0"],
    ["VERIFIER_CONTEXT_CHARS", "NaN"], ["REPRO_MAX_TOKENS", "-2"],
    ["REPRO_TIMEOUT_MS", "0"], ["REPRO_ATTEMPTS", "abc"],
    ["MAX_RETRIES", "1.5"], ["DUAL_SCAN_MAX_LOC", "-1"],
    ["PATCH_MAX_TOKENS", "bad"], ["PATCH_MAX_CANDIDATES", "-1"]
  ]) {
    assert.throws(function () { loadConfig({ [name]: value }); }, function (error) {
      return error.message.includes(name) && error.message.includes(value);
    }, name + "=" + value);
  }
  assert.equal(loadConfig({}).maxFindings, 8);
  assert.equal(loadConfig({ BUDGET_USD: "3.5", MAX_FINDINGS: "12", MAX_RETRIES: "0" }).budgetUsd, 3.5);
  const zeroLimits = loadConfig({ BUDGET_USD: "0", PATCH_MAX_CANDIDATES: "0" });
  assert.equal(zeroLimits.budgetUsd, 0);
  assert.equal(zeroLimits.patchMaxCandidates, 0);
  assert.equal(loadConfig({ REPRO_ATTEMPTS: "1" }).reproAttempts, 3);
  assert.equal(loadConfig({ REPRO_ATTEMPTS: "20" }).reproAttempts, 10);
});

test("D6 report states whether LinkCheck proved a symbol or file coverage", function () {
  const baseRun = { repo: { commit: "abc" }, runId: "test", mode: "smoke", calls: 0, retries: 0,
    findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 },
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false }, repro: { enabled: true, attempts: 3 } };
  const repo = { files: [], loc: 0, edges: [], cycles: [] };
  const makeReport = function (method) {
    const repro = { status: "reproduced", controlCode: "control()", testCode: "trigger()",
      control: { attempts: [{}, {}, {}] }, trigger: { attempts: [{}, {}, {}] },
      linkcheck: { status: "proven", method } };
    return buildReport({ repo, run: baseRun, published: [{ finding: finding("F-001", "The page includes one extra item."),
      status: "verified", verifier: { model: "m", verdict: "confirm", reason: "yes" }, repro }] });
  };
  assert.match(makeReport("file"), /\*\*LinkCheck:\*\* proven \(file coverage\) - the cited file executed/);
  assert.match(makeReport("symbol"), /\*\*LinkCheck:\*\* proven \(symbol\) - the imported symbol executed/);
});

test("D2 ingest fails closed when a requested commit cannot be read in a git repository", function (t) {
  const dir = tempDir(t, "codeproof-d2-git-");
  writeFileSync(join(dir, "a.js"), "export const a = 1;\n");
  execFileSync("git", ["-C", dir, "init", "-q"]);
  execFileSync("git", ["-C", dir, "add", "a.js"]);
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init"]);
  assert.throws(function () { ingest(dir, { commit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" }); }, /could not be read/);
  const plain = tempDir(t, "codeproof-d2-plain-");
  writeFileSync(join(plain, "b.js"), "export const b = 1;\n");
  const fallback = ingest(plain, { commit: "HEAD" });
  assert.equal(fallback.files.length, 1, "a non-git target keeps the documented working-tree fallback");
});

test("D4 warns when --out points inside the analyzed repository", function (t) {
  const dir = tempDir(t, "codeproof-d4-");
  const fixture = join(dir, "fixture");
  cpSync(join(repoRoot, "fixtures/mini-repo"), fixture, { recursive: true });
  const cliPath = join(repoRoot, "src/cli.mjs");
  const env = Object.assign({}, process.env, { USE_MOCK: "1" });
  const inside = spawnSync(process.execPath, [cliPath, "analyze", fixture, "--mock", "--mode", "demo", "--out", join(fixture, "reports")], { cwd: repoRoot, timeout: 120000, env: env, encoding: "utf8" });
  assert.equal(inside.status, 0, inside.stdout + inside.stderr);
  assert.match(inside.stdout + inside.stderr, /output directory is inside the analyzed repository/);
  const outside = spawnSync(process.execPath, [cliPath, "analyze", fixture, "--mock", "--mode", "demo", "--out", join(dir, "out")], { cwd: repoRoot, timeout: 120000, env: env, encoding: "utf8" });
  assert.equal(outside.status, 0, outside.stdout + outside.stderr);
  assert.doesNotMatch(outside.stdout + outside.stderr, /inside the analyzed repository/);
});
