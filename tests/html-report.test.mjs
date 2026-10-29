import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHtmlReport } from "../src/synthesize/html.mjs";
import { verifyAttestation } from "../src/run/attest.mjs";
import { replayRun } from "../src/run/replay.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(repoRoot, "src/cli.mjs");
const LF = String.fromCharCode(10);

function sampleRun() {
  return {
    runId: "abc123", mode: "demo", mock: true, configSha256: "cfg",
    models: [{ role: "scanner", id: "muse-spark-1.3" }],
    versions: { node: "v26.8.2", codeproof: "0.2.2" },
    repo: { files: 10, loc: 200, commit: "deadbeef" },
    findings: { proposed: 4, l1Rejected: 1, verified: 2, moderate: 1, refuted: 0, uncertain: 0 },
    usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 10, measured: false }
  };
}

function samplePublished(level, patchStatus) {
  return [{
    finding: {
      id: "F-001", severity: "high", title: "A defect", claim: "The value is wrong.",
      evidence: [{ path: "src/a.js", startLine: 3, endLine: 3, snippet: "return 1;" }]
    },
    status: "verified", evidenceLevel: level,
    verifier: { model: "m", verdict: "confirm", reason: "ok" },
    repro: { status: "reproduced", attemptCount: 3, controlCode: "control", testCode: "trigger", linkcheck: { status: "proven", method: "symbol" } },
    patch: { status: patchStatus, targetFile: "src/a.js", diff: "--- a" }
  }];
}

test("HTML report escapes every dynamic field", function () {
  const run = sampleRun();
  const published = [{
    finding: {
      id: "F-001", severity: "high",
      title: '"><img src=x onerror=alert(1)>',
      claim: "A & B < C",
      evidence: [{ path: "src/<bad>.js", startLine: 1, endLine: 2, snippet: "<script>alert(1)</script>" }]
    },
    status: "verified", evidenceLevel: "citation+adversarial",
    verifier: { model: "m", verdict: "confirm", reason: "<i>bad</i>", counterEvidence: { snippet: "<img>" } },
    repro: { status: "unavailable", reason: "<b>", controlCode: "</code>", testCode: "<script>x</script>" },
    patch: { status: "unsupported", targetFile: "<p>.js", reason: "<em>", searchBlock: "<s>", replaceBlock: "<r>", diff: "<script>alert(2)</script>" }
  }];
  const candidates = [{ candidate: { id: "<c1>" }, status: "l0-rejected", proposedBy: "<spark>", l0: { reasons: ["<img>"] } }];
  const html = buildHtmlReport({ run: run, published: published, candidates: candidates });
  assert.equal(html.indexOf("<img src=x onerror"), -1);
  assert.equal(html.indexOf("<script>"), -1);
  assert.ok(html.indexOf("&lt;img") !== -1, "escaped image tag must appear");
  assert.ok(html.indexOf("&amp;") !== -1, "ampersand must be escaped");
  assert.ok(html.indexOf("&lt;script&gt;") !== -1, "escaped script tag must appear");
});

test("HTML report is byte-deterministic and self-contained", function () {
  const options = { run: sampleRun(), published: samplePublished("execution-proven", "rejected"), candidates: [] };
  const first = buildHtmlReport(options);
  const second = buildHtmlReport(options);
  assert.equal(first, second, "the same inputs must produce identical bytes");
  assert.equal(first.indexOf("http://"), -1);
  assert.equal(first.indexOf("https://"), -1);
  assert.equal(first.indexOf("<script"), -1, "no script elements");
  assert.equal(first.indexOf(" src="), -1, "no external resources");
  assert.ok(first.indexOf("Evidence funnel") !== -1);
  assert.ok(first.indexOf("./findings.json") !== -1);
  assert.ok(first.indexOf("./REPORT.md") !== -1);
});

test("HTML funnel counts patch-proven findings in the L3 step", function () {
  const run = sampleRun();
  run.findings = { proposed: 4, l1Rejected: 1, verified: 2, moderate: 0, refuted: 0, uncertain: 0 };
  const published = samplePublished("execution-proven", "rejected").concat(samplePublished("patch-proven", "patch-proven"));
  published[0].finding = Object.assign({}, published[0].finding, { id: "F-001" });
  published[1].finding = Object.assign({}, published[1].finding, { id: "F-002" });
  const html = buildHtmlReport({ run: run, published: published, candidates: [] });
  const execution = html.match(/>([0-9]+)<\/div><div class="muted">execution-proven</);
  const patch = html.match(/>([0-9]+)<\/div><div class="muted">patch-proven</);
  assert.ok(execution, "execution-proven step must exist");
  assert.ok(patch, "patch-proven step must exist");
  assert.equal(execution[1], "2", "patch-proven implies execution-proven");
  assert.equal(patch[1], "1");
});

test("rejected candidates are collapsed and raw scan output never leaks", function () {
  const html = buildHtmlReport({
    run: sampleRun(), published: [],
    candidates: { raw: "RAW_SCAN_SECRET", candidates: [{ candidate: { id: "F-9" }, status: "l0-rejected", l0: { reasons: ["bad confidence"] } }] }
  });
  assert.equal(html.indexOf("RAW_SCAN_SECRET"), -1, "the raw scanner output must never enter the report");
  assert.ok(html.indexOf("Rejected candidates") !== -1);
  assert.ok(html.indexOf("<details><summary>Rejected candidates") !== -1, "rejected section starts collapsed");
  assert.ok(html.indexOf("bad confidence") !== -1);
});

function makeMockRun(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-html-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  const outDir = join(dir, "out");
  const result = spawnSync(process.execPath, [cliPath, "analyze", "fixtures/mini-repo", "--mock", "--mode", "demo", "--out", outDir], {
    cwd: repoRoot, timeout: 180000,
    env: Object.assign({}, process.env, { USE_MOCK: "1", MOCK_PIPELINE: "1" }), encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const runName = readdirSync(outDir, { withFileTypes: true }).find(function (entry) { return entry.isDirectory(); }).name;
  return join(outDir, runName);
}

test("every mock run writes REPORT.html covered by the attestation", function (t) {
  const runDir = makeMockRun(t);
  assert.ok(existsSync(join(runDir, "REPORT.html")), "REPORT.html must exist next to REPORT.md");
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  assert.ok(run.outputs && run.outputs.html, "run.json.outputs.html must point at the report");
  assert.ok(run.attestation && run.attestation.artifacts && run.attestation.artifacts["REPORT.html"], "the HTML must be inside the attestation");
  assert.deepEqual(verifyAttestation(runDir, run.attestation), []);
  const html = readFileSync(join(runDir, "REPORT.html"), "utf8");
  assert.ok(html.indexOf("CodeProof report") !== -1);
  assert.ok(html.indexOf("Evidence funnel") !== -1);
});

test("tampering with REPORT.html or adding a file after attestation is detected", function (t) {
  const runDir = makeMockRun(t);
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  appendFileSync(join(runDir, "REPORT.html"), "<p>tampered</p>" + LF);
  const tampered = verifyAttestation(runDir, run.attestation);
  assert.ok(tampered.some(function (problem) { return problem === "artifact hash mismatch: REPORT.html"; }), tampered.join("; "));
  writeFileSync(join(runDir, "extra.txt"), "x");
  const extra = verifyAttestation(runDir, run.attestation);
  assert.ok(extra.some(function (problem) { return problem === "artifact not covered by the attestation: extra.txt"; }), extra.join("; "));
});

test("offline replay passes on a run that includes REPORT.html", async function (t) {
  const runDir = makeMockRun(t);
  const result = await replayRun({ reportDir: runDir });
  assert.equal(result.matches, true, (result.problems || []).join("; "));
});
