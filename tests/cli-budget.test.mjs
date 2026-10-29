import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

function candidate(number) {
  const id = "F-" + String(number).padStart(3, "0");
  return {
    id,
    category: "correctness",
    kind: "direct",
    severity: "high",
    title: "Incorrect fixture result " + number,
    claim: "The fixture returns a value that contradicts its intended result.",
    evidence: [{ path: "src/fixture.js", startLine: 1, endLine: 1, snippet: "export const value = 1;" }],
    confidence: 0.9
  };
}

function runCli(dir) {
  return new Promise(function (resolve, reject) {
    const logPath = join(dir, "cli.log");
    const log = openSync(logPath, "w");
    const child = spawn(process.execPath, [cliPath, "analyze", dir, "--mock", "--mode", "demo", "--out", join(dir, "out"), "--allow-output-in-target"], {
      cwd: dir,
      env: { ...process.env, BUDGET_USD: "2", MOCK_PIPELINE: "0" },
      timeout: 60000,
      stdio: ["ignore", log, log]
    });
    closeSync(log);
    child.on("error", reject);
    child.on("close", function (code) { resolve({ code, output: readFileSync(logPath, "utf8") }); });
  });
}

test("T-C7/T-C8: budget abort publishes three processed findings and skips the next two calls", async function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-cli-budget-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/fixture.js"), "export const value = 1;\n");
    const findings = [1, 2, 3, 4, 5].map(candidate);
    writeFileSync(join(dir, "mock-scenario.json"), JSON.stringify({
      scanner: { costUsd: 0.4 },
      findings,
      verdicts: findings.map(function (finding, index) {
        return {
          findingId: finding.id,
          verdict: "confirm",
          reason: "The fixture shows this confirmed finding.",
          costUsd: [0.6, 0.6, 0.5, 0.5, 0.5][index]
        };
      })
    }));
    const result = await runCli(dir);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /budget exceeded.*2\.1.*2/i);
    assert.equal(existsSync(join(dir, "out")), true, result.output);
    const runs = readdirSync(join(dir, "out"), { withFileTypes: true }).filter(function (entry) { return entry.isDirectory(); });
    assert.equal(runs.length, 1);
    const runDir = join(dir, "out", runs[0].name);
    for (const name of ["run.json", "findings.json", "REPORT.md", "rejected.md", "candidates.json"]) {
      assert.equal(existsSync(join(runDir, name)), true, name);
    }
    const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
    assert.equal(run.budget.exceeded, true);
    assert.equal(run.budget.aborted, true);
    assert.equal(run.budget.spentUsd, 2.1);
    assert.equal(run.usage.costUsd, 2.1);
    assert.equal(run.budget.limitUsd, 2);
    assert.deepEqual(run.budget.skippedFindings, ["F-004", "F-005"]);
    assert.deepEqual(run.usage.callLog.map(function (call) { return call.role; }), ["scanner", "verifier", "verifier", "verifier"]);
    assert.equal(run.findings.verified, 3);
    assert.deepEqual(JSON.parse(readFileSync(join(runDir, "findings.json"), "utf8")).map(function (item) { return item.finding.id; }), ["F-001", "F-002", "F-003"]);
    assert.deepEqual(JSON.parse(readFileSync(join(runDir, "candidates.json"), "utf8")).candidates.map(function (item) { return item.status; }), ["verified", "verified", "verified", "skipped-budget", "skipped-budget"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
