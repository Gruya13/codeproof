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
