import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { replayRun } from "../src/run/replay.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(repoRoot, "src/cli.mjs");

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-replay-test-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function makeMockRun(t) {
  const dir = tempDir(t);
  const outDir = join(dir, "out");
  const result = spawnSync(process.execPath, [cliPath, "analyze", "fixtures/mini-repo", "--mock", "--mode", "demo", "--out", outDir], {
    cwd: repoRoot,
    timeout: 120000,
    env: Object.assign({}, process.env, { USE_MOCK: "1", MOCK_PIPELINE: "1" }),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const runName = readdirSync(outDir, { withFileTypes: true }).find(function (entry) { return entry.isDirectory(); }).name;
  return join(outDir, runName);
}

function cloneDir(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) cloneDir(join(source, entry.name), join(target, entry.name));
    else copyFileSync(join(source, entry.name), join(target, entry.name));
  }
}

test("replay of a fresh v2 run matches: attestation, config hash, L1, L3 and L4", async function (t) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const runDir = makeMockRun(t);
  const result = await replayRun({ reportDir: runDir, attempts: 1 });
  assert.equal(result.mode, "v2");
  assert.equal(result.attestation.problems.length, 0);
  assert.equal(result.problems.length, 0, result.problems.join("; "));
  assert.equal(result.mismatches.length, 0, result.mismatches.join("; "));
  assert.equal(result.matches, true);
  const entry = result.findings.find(function (item) { return item.id === "F-001"; });
  assert.ok(entry);
  assert.equal(entry.l1.passed, true);
  assert.equal(entry.l3.control, "passed");
  assert.equal(entry.l3.trigger, "assertion-failure");
  // L4 needs the LinkCheck linkage proof, which only Node 26 can award (fail-closed on Node 22).
  if (nodeMajor >= 26) assert.equal(entry.l4.status, "patch-proven");
  else assert.equal(entry.l4, null, "Node 22 must not replay a patch proof it could not have awarded");
  assert.match(result.resultHash, /^[0-9a-f]{64}$/);
});

test("replay detects a tampered findings title (valid but changed) through the attestation", async function (t) {
  const source = makeMockRun(t);
  const dir = tempDir(t);
  cloneDir(source, dir);
  const findingsPath = join(dir, "findings.json");
  const findings = JSON.parse(readFileSync(findingsPath, "utf8"));
  findings[0].finding.title = findings[0].finding.title + " (edited)";
  writeFileSync(findingsPath, JSON.stringify(findings, null, 2) + "\n");
  const result = await replayRun({ reportDir: dir, attempts: 1 });
  assert.equal(result.matches, false);
  assert.ok(result.problems.some(function (problem) { return /attestation/.test(problem); }));
});

test("replay detects a tampered report and a tampered repro test", async function (t) {
  const source = makeMockRun(t);
  const reportDir = tempDir(t);
  cloneDir(source, reportDir);
  writeFileSync(join(reportDir, "REPORT.md"), readFileSync(join(reportDir, "REPORT.md"), "utf8") + "\nedited\n");
  const reportResult = await replayRun({ reportDir: reportDir, attempts: 1 });
  assert.equal(reportResult.matches, false);
  const testDir = tempDir(t);
  cloneDir(source, testDir);
  const testPath = join(testDir, "repro/F-001/test.mjs");
  writeFileSync(testPath, readFileSync(testPath, "utf8").replace("[1, 2]", "[1, 2, 3]"));
  const testResult = await replayRun({ reportDir: testDir, attempts: 1 });
  assert.equal(testResult.matches, false);
});

test("git anchor detects a report changed together with a rewritten attestation", async function (t) {
  const source = makeMockRun(t);
  const dir = tempDir(t);
  cloneDir(source, dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "report"], { cwd: dir });
  // A disk-consistent tamper: edit REPORT.md and rewrite its hash inside run.json.
  const reportPath = join(dir, "REPORT.md");
  writeFileSync(reportPath, readFileSync(reportPath, "utf8") + "\nedited and rehashed\n");
  const crypto = await import("node:crypto");
  const newHash = crypto.createHash("sha256").update(readFileSync(reportPath)).digest("hex");
  const runPath = join(dir, "run.json");
  const run = JSON.parse(readFileSync(runPath, "utf8"));
  run.attestation.artifacts["REPORT.md"] = newHash;
  writeFileSync(runPath, JSON.stringify(run, null, 2) + "\n");
  const diskResult = await replayRun({ reportDir: dir, attempts: 1 });
  assert.equal(diskResult.attestation.problems.length, 0, "the disk tamper is self-consistent");
  const anchored = await replayRun({ reportDir: dir, anchor: "HEAD", attempts: 1 });
  assert.equal(anchored.gitAnchored, false);
  assert.equal(anchored.matches, false);
  assert.ok(anchored.problems.some(function (problem) { return /git anchor/.test(problem); }));
});

test("the historical v1 report replays in limited mode without model calls", async function (t) {
  const result = await replayRun({ reportDir: join(repoRoot, "reports/golden") });
  assert.equal(result.mode, "v1");
  assert.ok(result.notes.some(function (note) { return /not replayable/.test(note); }));
});