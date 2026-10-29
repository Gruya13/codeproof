import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ablation passes configured hard budget to createAgents", function () {
  const source = readFileSync(new URL("../scripts/ablation.mjs", import.meta.url), "utf8");
  const call = source.match(/\bcreateAgents\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(call, "createAgents options must be present");
  const optionsWithoutComments = call[1].replace(/\/\/[^\n]*/g, "");
  assert.match(optionsWithoutComments, /\bhardBudget\s*:\s*config\.hardBudget\b/);
});
