import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

test("F2/F7: a successful mock run retains raw text and per-candidate decisions", async function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-candidates-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/fixture.js"), "export const value = 1;\n");
    const valid = {
      id: "F-001", category: "correctness", kind: "direct", severity: "high",
      title: "Incorrect fixture result", claim: "The fixture returns the incorrect result in this case.",
      evidence: [{ path: "src/fixture.js", startLine: 1, endLine: 1, snippet: "export const value = 1;" }],
      confidence: 0.9
    };
    const invalid = { ...valid, id: "F-002", confidence: 2 };
    const l1Invalid = { ...valid, id: "F-003", evidence: [{ path: "src/fixture.js", startLine: 1, endLine: 1, snippet: "export const value = 2;" }] };
    const raw = JSON.stringify({ findings: [valid, invalid, l1Invalid] });
    writeFileSync(join(dir, "mock-scenario.json"), JSON.stringify({
      findings: [valid, invalid, l1Invalid],
      verdicts: [{ findingId: "F-001", verdict: "confirm", reason: "The fixture confirms this finding." }]
    }));
    const result = await new Promise(function (resolve, reject) {
      const logPath = join(dir, "cli.log");
      const log = openSync(logPath, "w");
      const child = spawn(process.execPath, [cliPath, "analyze", dir, "--mock", "--mode", "demo", "--out", join(dir, "out")], {
        cwd: dir, env: { ...process.env, BUDGET_USD: "2" }, timeout: 60000, stdio: ["ignore", log, log]
      });
      closeSync(log);
      child.on("error", reject);
      child.on("close", function (code) { resolve({ code, output: readFileSync(logPath, "utf8") }); });
    });
    assert.equal(result.code, 0, result.output);
    const runName = readdirSync(join(dir, "out"), { withFileTypes: true }).find(function (entry) { return entry.isDirectory(); }).name;
    const runDir = join(dir, "out", runName);
    const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
    const audit = JSON.parse(readFileSync(join(runDir, "candidates.json"), "utf8"));
    assert.equal(run.findings.proposed, 2);
    assert.equal(run.findings.l1Rejected, 1);
    assert.equal(run.findings.l0Rejected.count, 1);
    assert.deepEqual(run.findings.l0Rejected.items.map(function (item) { return item.id; }), ["F-002"]);
    assert.equal(run.budget.exceeded, false);
    assert.equal(run.budget.aborted, false);
    assert.equal(audit.raw, raw);
    assert.deepEqual(audit.candidates.map(function (item) { return item.status; }), ["verified", "l0-rejected", "l1-rejected"]);
    assert.equal(audit.candidates[0].l0.ok, true);
    assert.equal(audit.candidates[0].l1.passed, true);
    assert.equal(audit.candidates[0].verifier.verdict, "confirm");
    assert.equal(audit.candidates[1].l0.ok, false);
    assert.match(audit.candidates[1].l0.reasons.join("; "), /confidence/);
    assert.equal(audit.candidates[1].candidate.id, "F-002");
    assert.equal(audit.candidates[2].l1.passed, false);
    const scanRawPath = join(dir, "reports", "last-scan-raw.json");
    assert.equal(existsSync(scanRawPath), true);
    const scanRaw = JSON.parse(readFileSync(scanRawPath, "utf8"));
    assert.equal(scanRaw.raw, raw);
    assert.deepEqual(scanRaw.rejected.map(function (item) { return item.id; }), ["F-002"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
