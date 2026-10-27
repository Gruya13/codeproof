import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("cli runs a full mock demo end-to-end and writes a run.json with mode demo and repo.dirty", function (t) {
  const outDir = mkdtempSync(join(tmpdir(), "codeproof-cli-demo-"));
  t.after(function () { rmSync(outDir, { recursive: true, force: true }); });
  execFileSync(process.execPath, ["src/cli.mjs", "analyze", "fixtures/mini-repo", "--mock", "--mode", "demo", "--out", outDir], {
    cwd: repoRoot,
    timeout: 60000,
    stdio: "pipe"
  });
  const runs = readdirSync(outDir, { withFileTypes: true }).filter(function (entry) { return entry.isDirectory(); });
  assert.equal(runs.length, 1);
  const runDir = join(outDir, runs[0].name);
  assert.ok(existsSync(join(runDir, "REPORT.md")));
  assert.ok(existsSync(join(runDir, "findings.json")));
  assert.ok(existsSync(join(runDir, "rejected.md")));
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  assert.equal(run.mode, "demo");
  assert.equal(run.mock, true);
  assert.equal(typeof run.repo.dirty, "boolean");
  assert.equal(run.repo.dirty, false);
  assert.equal(run.repo.source, "commit", "ingestion inside a git repository must read the analyzed commit");
  assert.equal(run.budget.hard, Boolean(process.env.HARD_BUDGET !== "0"));
  assert.equal(run.findings.proposed, 4);
  assert.ok(run.findings.verified >= 1);
  assert.equal(run.dualScan, false);
});

test("cli runs a mock dual-scanner run: both scanners propose, duplicates collapse", function (t) {
  const outDir = mkdtempSync(join(tmpdir(), "codeproof-cli-dual-"));
  t.after(function () { rmSync(outDir, { recursive: true, force: true }); });
  execFileSync(process.execPath, ["src/cli.mjs", "analyze", "fixtures/mini-repo", "--mock", "--mode", "demo", "--out", outDir], {
    cwd: repoRoot,
    timeout: 60000,
    stdio: "pipe",
    env: Object.assign({}, process.env, { DUAL_SCAN: "1" })
  });
  const runs = readdirSync(outDir, { withFileTypes: true }).filter(function (entry) { return entry.isDirectory(); });
  assert.equal(runs.length, 1);
  const runDir = join(outDir, runs[0].name);
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  assert.equal(run.dualScan, true);
  assert.equal(run.scanners.length, 2);
  assert.deepEqual(run.scanners.map(function (scanner) { return scanner.proposedBy; }), ["spark", "wonder"]);
  // The mock adapter returns the same findings for both scanners, so everything collapses.
  assert.equal(run.findings.proposed, 4);
  assert.equal(run.findings.byScanner.spark, 4);
  assert.equal(run.findings.byScanner.wonder, 4);
  assert.equal(run.findings.byScanner.both, 4);
  assert.equal(run.findings.duplicates, 4);
  const report = readFileSync(join(runDir, "REPORT.md"), "utf8");
  assert.match(report, /\*\*Proposed by:\*\* Muse Spark \+ Muse Wonder/);
});
