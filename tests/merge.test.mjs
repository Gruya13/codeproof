import test from "node:test";
import assert from "node:assert/strict";
import { mergeScannerRuns, sameFinding, verifierRoleFor } from "../src/scan/merge.mjs";

function finding(id, path, startLine, endLine, claim) {
  return { id, category: "correctness", kind: "direct", severity: "high", title: "Finding " + id,
    claim: claim || "The code returns the wrong value in this case.",
    evidence: [{ path, startLine, endLine, snippet: "const x = 1;" }], confidence: 0.9 };
}

test("merge: two scanners reporting the same lines collapse into one finding with both proposers", function () {
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [finding("F-001", "src/a.ts", 10, 12)] },
    { proposedBy: "wonder", findings: [finding("F-001", "src/a.ts", 11, 13)] }
  ]);
  assert.equal(merged.candidates.length, 1);
  assert.deepEqual(merged.candidates[0].proposedBy, ["spark", "wonder"]);
  assert.deepEqual(merged.candidates[0].originalIds, ["F-001", "F-001"]);
  assert.equal(merged.duplicates.length, 1);
  assert.equal(merged.duplicates[0].mergedInto, merged.candidates[0].finding.id);
  assert.match(merged.candidates[0].finding.id, /^F-\d{3}$/);
});

test("merge: different lines stay separate findings", function () {
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [finding("F-001", "src/a.ts", 10, 12)] },
    { proposedBy: "wonder", findings: [finding("F-001", "src/a.ts", 40, 42)] }
  ]);
  assert.equal(merged.candidates.length, 2);
  assert.deepEqual(merged.candidates.map(function (candidate) { return candidate.proposedBy; }), [["spark"], ["wonder"]]);
});

test("merge: two distinct findings from the same scanner are never collapsed", function () {
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [finding("F-001", "src/a.ts", 10, 12), finding("F-002", "src/a.ts", 11, 12, "A different claim about the same line.")] }
  ]);
  assert.equal(merged.candidates.length, 2);
  assert.equal(merged.duplicates.length, 0);
});

test("merge: ids are renumbered to prevent collisions between scanners", function () {
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [finding("F-001", "src/a.ts", 10, 10)] },
    { proposedBy: "wonder", findings: [finding("F-001", "src/b.ts", 5, 5), finding("F-002", "src/c.ts", 7, 7)] }
  ]);
  assert.deepEqual(merged.candidates.map(function (candidate) { return candidate.finding.id; }), ["F-001", "F-002", "F-003"]);
});

test("merge: sameFinding needs the same file and overlapping ranges", function () {
  assert.equal(sameFinding(finding("F-001", "src/a.ts", 10, 12), finding("F-002", "src/a.ts", 12, 14)), true);
  assert.equal(sameFinding(finding("F-001", "src/a.ts", 10, 12), finding("F-002", "src/a.ts", 13, 14)), false);
  assert.equal(sameFinding(finding("F-001", "src/a.ts", 10, 12), finding("F-002", "src/b.ts", 10, 12)), false);
});

test("merge: the verifier role is the model that did not propose the finding", function () {
  assert.equal(verifierRoleFor(["spark"]), "verifier");
  assert.equal(verifierRoleFor(["wonder"]), "verifier-secondary");
  assert.equal(verifierRoleFor(["spark", "wonder"]), "verifier");
});