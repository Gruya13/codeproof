import test from "node:test";
import assert from "node:assert/strict";
import { validateFindingsL0 } from "../src/scan/index.mjs";

function finding(id) {
  return {
    id,
    category: "correctness",
    kind: "direct",
    severity: "high",
    title: "Incorrect returned value",
    claim: "The returned value differs from the documented result.",
    evidence: [{ path: "src/example.js", startLine: 1, endLine: 1, snippet: "return wrong;" }],
    confidence: 0.9
  };
}

test("T-C4: L0 keeps a valid finding and audits only its invalid neighbor", function () {
  const valid = finding("F-001");
  const invalid = { ...finding("F-002"), category: "security" };
  const result = validateFindingsL0({ findings: [valid, invalid] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, [valid]);
  assert.deepEqual(result.acceptedIndices, [0]);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].index, 1);
  assert.equal(result.rejected[0].id, "F-002");
  assert.match(result.rejected[0].reasons.join("; "), /category/);
});

test("T-C5: duplicate ID, excessive evidence, and confidence outside range are rejected separately", function () {
  const valid = finding("F-001");
  const duplicate = finding("F-001");
  const tooMuchEvidence = { ...finding("F-003"), evidence: Array(4).fill(valid.evidence[0]) };
  const badConfidence = { ...finding("F-004"), confidence: 1.5 };
  const result = validateFindingsL0({ findings: [valid, duplicate, tooMuchEvidence, badConfidence] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, [valid]);
  assert.deepEqual(result.rejected.map(function (item) { return item.index; }), [1, 2, 3]);
  assert.match(result.rejected[0].reasons.join("; "), /duplicate/i);
  assert.match(result.rejected[1].reasons.join("; "), /evidence.*1-3/);
  assert.match(result.rejected[2].reasons.join("; "), /confidence.*0\.\.1/);
  assert.deepEqual(validateFindingsL0({ findings: [] }), {
    ok: true, findings: [], acceptedIndices: [], rejected: [], errors: []
  });
  assert.equal(validateFindingsL0({ result: [] }).ok, false);
});
