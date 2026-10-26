import test from "node:test";
import assert from "node:assert/strict";
import { buildScannerMessages, buildScannerResponseFormat, scannerSystemPrompt } from "../src/scan/index.mjs";

test("scanner response schema uses the configured finding limit", function () {
  assert.equal(buildScannerResponseFormat().json_schema.schema.properties.findings.maxItems, 8);
  assert.equal(buildScannerResponseFormat(12).json_schema.schema.properties.findings.maxItems, 12);
});

test("scanner prompt states the configured finding limit", function () {
  assert.match(scannerSystemPrompt(8), /at most 8 findings/);
  assert.match(scannerSystemPrompt(12), /at most 12 findings/);
});

test("scanner messages carry the configured limit into the system prompt", function () {
  const messages = buildScannerMessages({ digest: "repo digest", filesWithLineNumbers: "1 | code", maxFindings: 12 });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /at most 12 findings/);
  assert.match(messages[1].content, /repo digest/);
});

test("scanner messages default to 8 findings when no limit is given", function () {
  const messages = buildScannerMessages({ digest: "d", filesWithLineNumbers: "f" });
  assert.match(messages[0].content, /at most 8 findings/);
});
