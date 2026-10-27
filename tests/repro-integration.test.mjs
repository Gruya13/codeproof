import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReport } from "../src/synthesize/index.mjs";
import { createMockAgent } from "../src/agents/mock.mjs";
import { writeReproArtifacts, validateReproL0 } from "../src/repro/index.mjs";
import { loadConfig, computeConfigSha256 } from "../src/config.mjs";

const baseRun = {
  runId: "test", mode: "smoke", calls: 0, retries: 0,
  findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 },
  usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false },
  repo: { commit: null },
  repro: { enabled: true }
};

function sampleFinding() {
  return { id: "F-001", title: "Off-by-one page slice", claim: "The slice end is inclusive.",
    evidence: [{ path: "src/a.js", startLine: 1, endLine: 1, snippet: "const a = 1;" }] };
}

test("report is execution-proven and shows the generated test when L3 reproduced", function () {
  const published = [{
    finding: sampleFinding(), status: "verified",
    verifier: { model: "m", verdict: "confirm", reason: "confirmed" },
    repro: { status: "reproduced", testCode: "import assert from 'node:assert/strict';\nassert.equal(1, 2);",
      expectedBehavior: "slice should exclude the end", attempts: [{ stderr: "AssertionError: 1 != 2" }] },
    evidenceLevel: "execution-proven"
  }];
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published, run: baseRun });
  assert.match(report, /execution-proven/);
  assert.match(report, /## Reproduced by execution/);
  assert.match(report, /assert\.equal\(1, 2\)/);
  assert.match(report, /AssertionError/);
  assert.match(report, /Reproduced by execution \(L3\) \| 1/);
});

test("report marks a verified finding without execution proof", function () {
  const published = [{
    finding: sampleFinding(), status: "verified",
    verifier: { model: "m", verdict: "confirm", reason: "confirmed" },
    repro: { status: "unavailable", reason: "needs network" },
    evidenceLevel: "citation+adversarial"
  }];
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published, run: baseRun });
  assert.match(report, /Execution check:\*\* unavailable: needs network/);
  assert.doesNotMatch(report, /execution-proven/);
  assert.doesNotMatch(report, /## Reproduced by execution/);
});

test("report omits the L3 row when execution is disabled", function () {
  const published = [{ finding: sampleFinding(), status: "verified", repro: null, evidenceLevel: "citation+adversarial",
    verifier: { model: "m", verdict: "confirm", reason: "confirmed" } }];
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published, run: { ...baseRun, repro: { enabled: false } } });
  assert.doesNotMatch(report, /Reproduced by execution/);
});

test("config disables repro in mock mode and when REPRO=0, and the hash covers repro settings", function () {
  assert.equal(loadConfig({ USE_MOCK: "1" }).reproEnabled, false);
  assert.equal(loadConfig({ REPRO: "0" }).reproEnabled, false);
  const on = loadConfig({});
  assert.equal(on.reproEnabled, true);
  assert.equal(typeof on.reproModel, "string");
  assert.equal(on.reproAttempts, 3);
  const first = computeConfigSha256(on, "smoke");
  const second = computeConfigSha256({ ...on, reproAttempts: 5 }, "smoke");
  assert.notEqual(first, second);
});

test("mock adapter returns a valid unsupported repro response", async function (t) {
  const dir = mkdtempSync(join(tmpdir(), "mock-repro-scenario-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  const scenarioPath = join(dir, "mock-scenario.json");
  writeFileSync(scenarioPath, JSON.stringify({ findings: [], verdicts: [] }), "utf8");
  const complete = createMockAgent({ scenarioPath });
  const result = await complete({ role: "repro", messages: [{ role: "user", content: "{\"id\":\"F-001\"}" }] });
  const parsed = JSON.parse(result.text);
  const checked = validateReproL0(parsed);
  assert.equal(checked.ok, true, checked.errors.join("; "));
  assert.equal(parsed.kind, "unsupported");
  assert.equal(parsed.findingId, "F-001");
  assert.equal(parsed.testCode, "");
});

test("writeReproArtifacts persists the generated test and the runner result", function (t) {
  const dir = mkdtempSync(join(tmpdir(), "repro-artifacts-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  const artifacts = writeReproArtifacts(dir, "F-001", {
    status: "reproduced", classification: "assertion-failure", deterministic: true, attempts: [],
    testCode: "test code", expectedBehavior: "x", rationale: "y", reason: "z", model: "m", usage: {}, costUsd: 0
  });
  assert.ok(artifacts && artifacts.test);
  assert.equal(existsSync(join(dir, "repro", "F-001", "test.mjs")), true);
  const result = JSON.parse(readFileSync(join(dir, "repro", "F-001", "result.json"), "utf8"));
  assert.equal(result.status, "reproduced");
  assert.equal(result.classification, "assertion-failure");
});