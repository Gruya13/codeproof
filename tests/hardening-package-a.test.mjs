import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceLevelFor } from "../src/cli.mjs";
import { configPayloadSha256 } from "../src/config.mjs";
import { applyPatchToSnapshot, runPatchGate, validateTargetFile } from "../src/patch/index.mjs";
import { runLinkCheck } from "../src/repro/linkcheck.mjs";
import { buildAttestation } from "../src/run/attest.mjs";
import { replayRun } from "../src/run/replay.mjs";
import { verifyOne } from "../src/verify/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = join(root, "fixtures/mini-repo");
const cliPath = join(root, "src/cli.mjs");

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-hardening-a-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function makeV2Report(t, findings) {
  const dir = tempDir(t);
  const reportDir = join(dir, "report");
  mkdirSync(reportDir);
  writeFileSync(join(reportDir, "findings.json"), JSON.stringify(findings) + "\n");
  const payload = { mode: "demo" };
  writeFileSync(join(reportDir, "run.json"), JSON.stringify({
    configHashVersion: 2,
    config: { payload },
    configSha256: configPayloadSha256(payload),
    attestation: buildAttestation(reportDir),
    repo: { path: fixture, commit: "HEAD" }
  }) + "\n");
  return { dir, reportDir };
}

test("LinkCheck refuses a pre-existing symlink and leaves its external target untouched", async function (t) {
  const dir = tempDir(t);
  const snapshotDir = join(dir, "snapshot");
  mkdirSync(snapshotDir);
  const target = join(dir, "outside.mjs");
  writeFileSync(target, "original\n");
  const probe = join(snapshotDir, ".codeproof-linkcheck.probe.mjs");
  symlinkSync(target, probe);
  const result = await runLinkCheck({ testCode: "throw new Error('should never run')", snapshotDir, targetFile: "lib.js", symbols: ["lib"] });
  assert.equal(result.status, "unproven");
  assert.match(result.detail, /already exists/);
  assert.equal(readFileSync(target, "utf8"), "original\n");
  assert.equal(readFileSync(probe, "utf8"), "original\n");
});

test("L4 rejects absolute, traversal and symlink targets at its write boundary", async function (t) {
  const dir = tempDir(t);
  const snapshotDir = join(dir, "snapshot");
  mkdirSync(snapshotDir);
  writeFileSync(join(snapshotDir, "good.js"), "export const value = 1;\n");
  const outside = join(dir, "outside.js");
  writeFileSync(outside, "export const value = 1;\n");
  symlinkSync(outside, join(snapshotDir, "link.js"));
  const outsideDir = join(dir, "outside-dir");
  mkdirSync(outsideDir);
  writeFileSync(join(outsideDir, "nested.js"), "export const value = 1;\n");
  symlinkSync(outsideDir, join(snapshotDir, "link-dir"));
  assert.equal(validateTargetFile("good.js", snapshotDir).ok, true);
  for (const targetFile of [outside, "../outside.js", "link.js", "link-dir/nested.js"]) {
    const checked = validateTargetFile(targetFile, snapshotDir);
    assert.equal(checked.ok, false, targetFile);
    assert.throws(function () {
      applyPatchToSnapshot({ snapshotDir, targetFile, searchBlock: "value = 1", replaceBlock: "value = 2" });
    }, /invalid targetFile/);
    await assert.rejects(runPatchGate({ snapshotDir, targetFile, searchBlock: "value = 1", replaceBlock: "value = 2" }), /invalid targetFile/);
  }
  assert.equal(readFileSync(outside, "utf8"), "export const value = 1;\n");
});

test("v2 replay rejects an L4 traversal from report data before patching", async function (t) {
  const controlCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nassert.deepEqual(page([], 0, 2), []);\n";
  const testCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nassert.deepEqual(page([1, 2, 3, 4], 0, 2), [1, 2]);\n";
  const finding = { id: "F-001", evidence: [{ path: "src/pagination.js", startLine: 3, endLine: 3, snippet: "  return items.slice(start, start + size + 1);" }] };
  const item = { finding, status: "verified", repro: { controlCode, testCode }, patch: { status: "patch-proven", targetFile: "../../evil.js", searchBlock: "value = 1", replaceBlock: "value = 2" } };
  const { dir, reportDir } = makeV2Report(t, [item]);
  const result = await replayRun({ reportDir, workDir: dir, attempts: 1 });
  assert.equal(result.matches, false);
  assert.ok(result.problems.some(function (problem) { return /L4 invalid targetFile/.test(problem); }), result.problems.join("; "));
  assert.equal(result.findings[0].l4.status, "invalid-target");
  assert.equal((await import("node:fs")).existsSync(join(dir, "evil.js")), false);
});

test("strong-refute retry failure preserves the primary moderate result", async function (t) {
  const dir = tempDir(t);
  writeFileSync(join(dir, "guard.js"), "const value = input.value;\n");
  const finding = { id: "F-001", evidence: [{ path: "guard.js", startLine: 1, endLine: 1, snippet: "const value = input.value;" }] };
  let calls = 0;
  const agent = { async complete() {
    calls += 1;
    if (calls === 2) throw new Error("network down");
    return { text: JSON.stringify({ verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "possible counterexample" }] }), model: "fake" };
  } };
  const result = await verifyOne({ finding, repo: { root: dir, manifest: new Map([["guard.js", {}]]) }, agent, excerpts: "   1 | const value = input.value;" });
  assert.equal(calls, 2);
  assert.equal(result.status, "moderate");
});

test("evidence levels are only assigned to verified findings", function () {
  const repro = { status: "reproduced", linkcheck: { status: "proven" } };
  const patch = { status: "patch-proven" };
  assert.equal(evidenceLevelFor("verified", patch, repro), "patch-proven");
  assert.equal(evidenceLevelFor("verified", null, repro), "execution-proven");
  assert.equal(evidenceLevelFor("verified", null, null), "citation+adversarial");
  for (const status of ["refuted", "moderate", "uncertain", "unresolved", "l0-rejected", "l1-rejected"]) {
    assert.equal(evidenceLevelFor(status, patch, repro), null, status);
  }
});

test("v2 replay and CLI fail when the repository checkout is unavailable", async function (t) {
  const { dir, reportDir } = makeV2Report(t, []);
  const missing = join(dir, "missing-repository");
  const result = await replayRun({ reportDir, repoPath: missing });
  assert.equal(result.matches, false);
  assert.ok(result.problems.some(function (problem) { return /checkout is not available/.test(problem); }));
  const cli = spawnSync(process.execPath, [cliPath, "replay", reportDir, "--repo", missing], { encoding: "utf8", timeout: 30000 });
  assert.equal(cli.status, 1, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /REPLAY FAIL/);
});
