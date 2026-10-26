import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("cli runs a full mock demo end-to-end and writes a run.json with mode demo and repo.dirty", function () {
  const outDir = mkdtempSync(join(tmpdir(), "codeproof-cli-demo-"));
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
  assert.equal(run.findings.proposed, 4);
  assert.ok(run.findings.verified >= 1);
});
