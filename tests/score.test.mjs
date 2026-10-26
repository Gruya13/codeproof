import test from "node:test";
import assert from "node:assert/strict";
import { scoreRun, matchTarget, buildIndex } from "../bench/score.mjs";

const expected = {
  problems: [
    { id: "B-01", file: "src/a.ts", startLine: 10, endLine: 10 },
    { id: "B-02", file: "src/b.ts", startLine: 5, endLine: 6 }
  ],
  traps: [{ id: "T-01", file: "src/c.ts", startLine: 20, endLine: 20 }],
  extraTrue: [{ id: "X-01", file: "src/d.ts", startLine: 1, endLine: 1 }],
  scoring: { e2eRecallMin: 2, precisionMin: 0.9, trapsVerifiedMax: 0, falseRefutationsMax: 1 }
};

function finding(id, path, line, status) {
  return { finding: { id: id, title: id, evidence: [{ path: path, startLine: line, endLine: line }] }, status: status };
}

test("matchTarget requires the same file and overlapping lines", function () {
  const index = buildIndex(expected);
  assert.equal(matchTarget({ path: "src/a.ts", startLine: 10, endLine: 10 }, index).id, "B-01");
  assert.equal(matchTarget({ path: "src/a.ts", startLine: 9, endLine: 9 }, index), null);
  assert.equal(matchTarget({ path: "src/z.ts", startLine: 10, endLine: 10 }, index), null);
});

test("verified problem is TP, unmatched verified is FP, trap leak is counted", function () {
  const metrics = scoreRun(expected, [
    finding("F-001", "src/a.ts", 10, "verified"),
    finding("F-002", "src/z.ts", 99, "verified"),
    finding("F-003", "src/c.ts", 20, "verified"),
    finding("F-004", "src/b.ts", 5, "refuted"),
    finding("F-005", "src/d.ts", 1, "verified")
  ]);
  assert.equal(metrics.verifiedTp, 1);
  assert.equal(metrics.verifiedFp, 2);
  assert.equal(metrics.trapsVerified, 1);
  assert.equal(metrics.falseRefutations, 1);
  assert.ok(metrics.extraTrueSeen.includes("X-01"));
  assert.ok(Math.abs(metrics.precision - 1 / 3) < 1e-9);
  assert.ok(metrics.falsePositives.some(function (fp) { return fp.trap === true; }));
  assert.equal(metrics.pass, false);
});

test("moderate or refuted trap is not a false positive", function () {
  const metrics = scoreRun(expected, [
    finding("F-001", "src/a.ts", 10, "verified"),
    finding("F-002", "src/c.ts", 20, "moderate"),
    finding("F-003", "src/c.ts", 20, "refuted")
  ]);
  assert.equal(metrics.verifiedTp, 1);
  assert.equal(metrics.verifiedFp, 0);
  assert.equal(metrics.trapsVerified, 0);
  assert.equal(metrics.trapsModerate, 1);
  assert.equal(metrics.precision, 1);
});

test("a verified trap lowers precision like any other false positive", function () {
  const metrics = scoreRun(expected, [
    finding("F-001", "src/a.ts", 10, "verified"),
    finding("F-002", "src/b.ts", 5, "verified"),
    finding("F-003", "src/c.ts", 20, "verified")
  ]);
  assert.equal(metrics.verifiedTp, 2);
  assert.equal(metrics.verifiedFp, 1);
  assert.ok(Math.abs(metrics.precision - 2 / 3) < 1e-9);
  assert.equal(metrics.trapsVerified, 1);
});

test("duplicates are not false positives and do not add recall", function () {
  const metrics = scoreRun(expected, [
    finding("F-001", "src/a.ts", 10, "verified"),
    finding("F-002", "src/a.ts", 10, "verified")
  ]);
  assert.equal(metrics.verifiedTp, 1);
  assert.equal(metrics.verifiedFp, 0);
  assert.equal(metrics.duplicateVerified, 1);
});

test("precision is undefined when nothing is verified", function () {
  const metrics = scoreRun(expected, [finding("F-001", "src/a.ts", 10, "uncertain")]);
  assert.equal(metrics.precision, null);
});
