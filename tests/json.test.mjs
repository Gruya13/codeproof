import test from "node:test";
import assert from "node:assert/strict";
import { parseDirtyJson } from "../src/run/json.mjs";

const FENCE = "\u0060\u0060\u0060";

test("parses fenced JSON output", function () {
  const text = "\n" + FENCE + "json\n" + JSON.stringify({ findings: [] }) + "\n" + FENCE + "\n";
  const parsed = parseDirtyJson(text);
  assert.deepEqual(parsed, { findings: [] });
});

test("parses JSON with a trailing comma", function () {
  const parsed = parseDirtyJson("{\"verdicts\":[{\"verdict\":\"confirm\",}]}");
  assert.equal(parsed.verdicts[0].verdict, "confirm");
});

test("throws on output without a JSON object", function () {
  assert.throws(function () { parseDirtyJson("no json here"); });
});

test("parses fenced JSON with text before and after the code block", function () {
  const text = "Evo nalaza sa skeniranja:\n" + FENCE + "json\n" + JSON.stringify({ findings: [{ id: "F-001" }] }) + "\n" + FENCE + "\nNadam se da pomaže.";
  const parsed = parseDirtyJson(text);
  assert.deepEqual(parsed, { findings: [{ id: "F-001" }] });
});

test("parses fenced JSON with uppercase tag and extra whitespace", function () {
  const text = FENCE + "JSON   \n" + JSON.stringify({ ok: true }) + "\n" + FENCE + "  \n";
  const parsed = parseDirtyJson(text);
  assert.deepEqual(parsed, { ok: true });
});

test("parses fenced JSON without language identifier", function () {
  const text = FENCE + "\n" + JSON.stringify({ value: 42 }) + "\n" + FENCE;
  const parsed = parseDirtyJson(text);
  assert.deepEqual(parsed, { value: 42 });
});

test("strips UTF-8 BOM at the beginning of the text", function () {
  const text = "\uFEFF" + JSON.stringify({ bom: true });
  const parsed = parseDirtyJson(text);
  assert.deepEqual(parsed, { bom: true });
});

test("throws on empty string or whitespace only", function () {
  assert.throws(function () { parseDirtyJson(""); }, /empty model output/);
  assert.throws(function () { parseDirtyJson("   \n\t  "); }, /empty model output/);
  assert.throws(function () { parseDirtyJson("\uFEFF   "); }, /empty model output/);
});

test("returns the first JSON object when multiple sibling objects exist", function () {
  const text = "Objekat 1: {\"id\": \"F-001\"} Objekat 2: {\"id\": \"F-002\"}";
  const parsed = parseDirtyJson(text);
  assert.equal(parsed.id, "F-001");
});

test("trailing-comma tolerance does not corrupt commas inside string literals", function () {
  const parsed = parseDirtyJson("{\"a\": \",}\", \"b\": \",]\"}");
  assert.equal(parsed.a, ",}");
  assert.equal(parsed.b, ",]");
  const tolerant = parseDirtyJson("{\"findings\": [1, 2,],}");
  assert.deepEqual(tolerant.findings, [1, 2]);
});

test("T-C2: throws on truncated output (unclosed object, array or string)", function () {
  assert.throws(function () { parseDirtyJson("{\"findings\": [{\"id\": \"F-001\""); }, /no JSON object/);
  assert.throws(function () { parseDirtyJson("[1, 2, 3"); }, /no JSON object/);
  assert.throws(function () { parseDirtyJson("{\"a\": \"unclosed"); }, /no JSON object/);
  assert.throws(function () { parseDirtyJson("{\"a\": 1, \"b\": ["); }, /no JSON object/);
});

test("characterization: fails on JSON with single quotes", function () {
  assert.throws(function () {
    parseDirtyJson("{'findings': []}");
  });
});

test("characterization: fails on JSON with line comments", function () {
  assert.throws(function () {
    parseDirtyJson("{\n// ovo je komentar\n\"findings\": []}");
  });
});
