import test from "node:test";
import assert from "node:assert/strict";
import { mergeScannerRuns, sameFinding } from "../src/scan/merge.mjs";

function evidence(path, startLine, endLine) {
  return { path: path, startLine: startLine, endLine: endLine, snippet: "const x = 1;" };
}

function finding(id, entries, claim) {
  return { id: id, category: "correctness", kind: "direct", severity: "high", title: "Finding " + id,
    claim: claim, evidence: entries, confidence: 0.9 };
}

test("E1 claim stemming merges inflected paraphrases of the same defect", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "The page mutates the input array in place.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "Mutating the input array in place corrupts it.");
  assert.equal(sameFinding(left, right), true);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 1);
  assert.deepEqual(merged.candidates[0].proposedBy, ["spark", "wonder"]);
});

test("E1 stemming keeps genuinely different claims on the same line separate", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "The page includes one item beyond the requested end.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "The page mutates the input array in place.");
  assert.equal(sameFinding(left, right), false);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 2);
});

test("E2 dedup compares every evidence entry, not only the first", function () {
  const left = finding("F-001", [evidence("src/a.ts", 40, 42), evidence("src/a.ts", 10, 12)], "Mutates the input array in place.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "Mutating the input array in place corrupts it.");
  assert.equal(sameFinding(left, right), true);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 1);
  assert.deepEqual(merged.candidates[0].proposedBy, ["spark", "wonder"]);
});

test("E2 the same claim in different files is never merged", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "Mutates the input array in place.");
  const right = finding("F-002", [evidence("src/b.ts", 10, 12)], "Mutates the input array in place.");
  assert.equal(sameFinding(left, right), false);
});
