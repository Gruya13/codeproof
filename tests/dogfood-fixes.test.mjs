import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as merge from "../src/scan/merge.mjs";
import { assertionTiedToSymbols, hasTautology } from "../src/repro/static-checks.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";
import { buildReport } from "../src/synthesize/index.mjs";

test("F-002: scanner counts include joint proposals and track secondary separately", function () {
  const entries = ["spark", "wonder", "secondary", "spark,wonder", "controlled"].map(function (labels) {
    return { proposedBy: labels.split(",") };
  });
  assert.equal(typeof merge.countByScanner, "function");
  const counts = merge.countByScanner(entries);
  assert.deepEqual(counts, { spark: 2, wonder: 2, secondary: 1, both: 1, controlled: 1 });
  const withoutSecondary = merge.countByScanner(entries.filter(function (entry) { return !entry.proposedBy.includes("secondary"); }));
  assert.equal(withoutSecondary.spark, counts.spark);
  assert.equal(withoutSecondary.wonder, counts.wonder);
  assert.equal(withoutSecondary.both, counts.both);
  assert.equal(withoutSecondary.controlled, counts.controlled);
});

test("F-003: inherited object names can be assertion symbols", function () {
  for (const symbol of ["toString", "constructor", "hasOwnProperty"]) {
    const result = assertionTiedToSymbols("assert.equal(" + symbol + "(x), 1);", [symbol]);
    assert.equal(result.ok, true, symbol);
    assert.equal(result.symbol, symbol);
  }
});

test("F-004: self-comparison outside assertions is not a tautological assertion", function () {
  assert.equal(hasTautology("const same = (a === a);\nassert.equal(f(), 1);"), null);
  assert.equal(hasTautology("assert.equal(a, a);"), "same expression on both sides");
  assert.equal(hasTautology("assert.equal(1, 1);"), "same expression on both sides");
});

test("F-005: dirty JSON extraction treats backslash as escape only inside a string", function () {
  assert.deepEqual(parseDirtyJson('noise {\\} {"ok":true} tail'), { ok: true });
  // firstJsonObject is private. Check its escape branch until it is exported for a direct test.
  const source = readFileSync(new URL("../src/run/json.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function firstJsonObject(");
  const end = source.indexOf("export function parseDirtyJson", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /if\s*\(inString\)\s*\{\s*if\s*\(escape\)/);
});

test("F-006: LinkCheck error does not claim proof while proven status does", function () {
  const repo = { files: [], loc: 0, edges: [], cycles: [] };
  const run = {
    repo: { commit: null }, runId: "dogfood-test", mode: "smoke",
    findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 },
    calls: 0, retries: 0, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false },
    repro: { enabled: true, attempts: 3 }
  };
  const finding = { id: "F-006", severity: "medium", title: "LinkCheck wording", claim: "Proof wording must follow status.", evidence: [] };
  const published = function (status) {
    return [{ finding, status: "verified", verifier: { model: "test", verdict: "confirm", reason: "confirmed" },
      repro: { status: "reproduced", testCode: "assert.equal(1, 2);", linkcheck: { status, detail: "coverage result", method: "symbol" } } }];
  };
  const errorReport = buildReport({ repo, run, published: published("error") });
  assert.doesNotMatch(errorReport, /the imported symbol executed under inspector coverage/);
  assert.match(errorReport, /did not award an execution proof/);
  const provenReport = buildReport({ repo, run, published: published("proven") });
  assert.match(provenReport, /the imported symbol executed under inspector coverage/);
});
