import test from "node:test";
import assert from "node:assert/strict";
import { buildRejected, buildReport, mermaidGraph } from "../src/synthesize/index.mjs";
import { buildRunBanner } from "../src/cli.mjs";
import { readFileSync } from "node:fs";

test("T-C14: Mermaid labels escape special file names while preserving graph structure", function () {
  const repo = {
    files: [
      { path: 'src/a"b.ts' },
      { path: "src/line\nb.ts" },
      { path: "src/[user]\u0001.ts" }
    ],
    edges: [
      { from: 'src/a"b.ts', to: "src/line\nb.ts" },
      { from: "src/line\nb.ts", to: "src/[user]\u0001.ts" }
    ],
    cycles: [['src/a"b.ts', "src/line\nb.ts", 'src/a"b.ts']]
  };
  const lines = mermaidGraph(repo).split("\n");
  assert.equal(lines[0], "graph LR");
  assert.equal(lines.length, 1 + repo.files.length + repo.edges.length + repo.cycles.length);
  const labels = lines.filter(function (line) { return /^  n\d+\["/.test(line); });
  assert.equal(labels.length, repo.files.length);
  for (const line of labels) {
    const match = /^  n\d+\["([^"\n]*)"\]$/.exec(line);
    assert.ok(match, "invalid Mermaid label: " + line);
    assert.equal(/[\x00-\x1f\x7f]/.test(match[1]), false);
  }
  assert.ok(labels[0].includes("a#quot;b.ts"));
  assert.ok(labels[1].includes("line<br/>b.ts"));
  assert.ok(labels[2].includes("[user].ts"));
  assert.deepEqual(lines.filter(function (line) { return line.includes(" --> "); }), [
    "  n0 --> n1", "  n1 --> n2"
  ]);
  assert.equal(lines.filter(function (line) { return line.startsWith("  %% cycle:"); }).length, 1);
});

test("report separates moderate findings and rejected file records L1 and budget outcomes", function () {
  const run = { repo: { commit: "commit" }, runId: "test", mode: "smoke", findings: { proposed: 3, l1Rejected: 1, verified: 0, moderate: 1, refuted: 0, uncertain: 0 }, calls: 0, retries: 0, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false } };
  const finding = { id: "F-001", title: "Weakly refuted finding", claim: "The claim was weakly refuted.", evidence: [] };
  const published = [{ finding, status: "moderate", verifier: { model: "test", mode: "weak", reason: "A weak reason." } }];
  const candidates = [
    { index: 0, candidate: { id: "F-002", title: "Bad citation", claim: "The citation is not in the commit." }, status: "l1-rejected", l1: { reason: "snippet mismatch" } },
    { index: 1, candidate: { id: "F-003", title: "Skipped finding", claim: "The budget was exhausted." }, status: "skipped-budget" }
  ];
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published, run });
  const rejected = buildRejected({ published, candidates, run });
  assert.equal(report.includes("## Moderate confidence"), false);
  assert.match(rejected, /Rejected at L1 \(citation check\)/);
  assert.match(rejected, /F-002 - Bad citation/);
  assert.match(rejected, /snippet mismatch/);
  assert.match(rejected, /Moderate confidence \(weak refutation\)/);
  assert.match(rejected, /F-001 - Weakly refuted finding/);
  assert.match(rejected, /Skipped \(budget\)/);
  assert.match(rejected, /F-003 - Skipped finding/);
});

test("CLI banner exposes modes, models and controlled provenance", function () {
  const mock = buildRunBanner({ mock: true, controlled: false, mode: "demo", target: "fixture", runId: "id" });
  assert.match(mock, /MOCK MODE/);
  assert.match(mock, /mode mock/);
  assert.match(mock, /no model calls/);
  const bench = buildRunBanner({ mock: false, controlled: false, mode: "bench", target: "fixture", runId: "id", scannerModel: "spark", verifierModel: "wonder" });
  assert.match(bench, /mode bench/);
  assert.match(bench, /models scanner=spark verifier=wonder/);
  const controlled = buildRunBanner({ mock: false, controlled: true, mode: "controlled-verifier", target: "fixture", runId: "id", verifierModel: "wonder" });
  assert.match(controlled, /NOT presented as such/);
  assert.match(controlled, /scanner=skipped/);
});

test("README declares evidence levels and the planned L3 boundary", function () {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test\./);
  assert.match(readme, /## Evidence levels/);
  assert.match(readme, /execution-proven.*not implemented yet/);
});

test("report labels a model snippet when no committed blob is available", function () {
  const finding = { id: "F-001", severity: "low", title: "Uncommitted example", claim: "The sample line returns the wrong value.", evidence: [{ path: "src/missing.js", startLine: 1, endLine: 1, snippet: "return 99;" }] };
  const run = { repo: { commit: null, path: "/nonexistent/codeproof-target" }, runId: "test", mode: "smoke", findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 }, calls: 0, retries: 0, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false } };
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published: [{ finding, status: "verified", verifier: { model: "test", verdict: "confirm", reason: "test" } }], run });
  assert.match(report, /model-provided snippet; file not in commit/);
  assert.match(report, /return 99;/);
});
