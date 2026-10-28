import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { attemptRepro, validateReproL0 } from "../src/repro/index.mjs";
import { runLinkCheck } from "../src/repro/linkcheck.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const miniRepo = join(repoRoot, "fixtures/mini-repo");

function gitHead() {
  return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-control-test-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

const CONTROL_PASS = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst empty = page([], 0, 2);\nassert.deepEqual(empty, []);\n";
const TRIGGER_FAIL = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst firstPage = page([1, 2, 3, 4, 5], 0, 2);\nassert.deepEqual(firstPage, [1, 2]);\n";

function response(controlCode, testCode) {
  return {
    findingId: "F-001",
    kind: "test",
    controlCode: controlCode,
    testCode: testCode,
    expectedBehavior: "page returns exactly size items for a full page",
    rationale: "the control proves the call is valid and the trigger exposes the extra item",
    unsupportedReason: ""
  };
}

test("a failing control yields control-failed and the trigger is never run", async function (t) {
  // Same symbol, a different input, and an assertion that fails: the control phase is invalid.
  const controlFails = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst empty = page([], 0, 2);\nassert.deepEqual(empty, [1]);\n";
  const agent = { async complete() { return { text: JSON.stringify(response(controlFails, TRIGGER_FAIL)), model: "fake", usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 0 }; } };
  const finding = { id: "F-001", title: "Off-by-one page slice", claim: "page returns one extra item", evidence: [{ path: "src/pagination.js", startLine: 3, endLine: 3, snippet: "return items.slice(start, start + size + 1);" }] };
  const result = await attemptRepro({ finding, agent, repoRoot: miniRepo, commit: gitHead(), excerpts: "", config: { reproWorkDir: tempDir(t) }, outDir: null });
  assert.equal(result.status, "control-failed", result.reason);
  assert.equal(result.control.deterministic, false);
  assert.equal(result.trigger, undefined, "the trigger must not run when the control fails");
  assert.match(result.reason, /control did not pass/);
});

test("a passing control and a failing trigger yield reproduced with both phases recorded", async function (t) {
  const agent = { async complete() { return { text: JSON.stringify(response(CONTROL_PASS, TRIGGER_FAIL)), model: "fake", usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 0 }; } };
  const finding = { id: "F-001", title: "Off-by-one page slice", claim: "page returns one extra item", evidence: [{ path: "src/pagination.js", startLine: 3, endLine: 3, snippet: "return items.slice(start, start + size + 1);" }] };
  const result = await attemptRepro({ finding, agent, repoRoot: miniRepo, commit: gitHead(), excerpts: "", config: { reproWorkDir: tempDir(t) }, outDir: null });
  assert.equal(result.status, "reproduced", result.reason);
  assert.equal(result.control.deterministic, true);
  assert.equal(result.control.classification, "passed");
  assert.equal(result.trigger.deterministic, true);
  assert.equal(result.trigger.classification, "assertion-failure");
  assert.equal(result.attempts.length, 3);
  assert.ok(result.linkcheck, "linkcheck must be recorded for a reproduced finding");
});

test("a decorative import is rejected by L0 before any execution", function () {
  const decorative = response(CONTROL_PASS, "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst ignored = page([1], 0, 2);\nassert.equal(1, 2);\n");
  const checked = validateReproL0(decorative);
  assert.equal(checked.ok, false);
  assert.match(checked.errors.join(" "), /not tied/);
});

test("LinkCheck proves a real call and rejects a dead call (Node 26 only)", async function (t) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const dir = tempDir(t);
  writeFileSync(join(dir, "lib.js"), "export function readValue() { return 42; }\n");
  const realCall = "import { readValue } from './lib.js';\nconst value = readValue();\n";
  const proven = await runLinkCheck({ testCode: realCall, snapshotDir: dir, targetFile: "lib.js", symbols: ["readValue"] });
  if (nodeMajor >= 26) {
    assert.equal(proven.status, "proven", proven.detail);
    assert.equal(proven.hit, undefined);
    assert.equal(Boolean(proven.executed.readValue), true);
  } else {
    assert.equal(proven.status, "unproven", "Node 22 has no --allow-inspector; the gate must fail closed");
  }
  const deadCall = "import { readValue } from './lib.js';\nif (false) { readValue(); }\n";
  const unproven = await runLinkCheck({ testCode: deadCall, snapshotDir: dir, targetFile: "lib.js", symbols: ["readValue"] });
  assert.equal(unproven.status, nodeMajor >= 26 ? "unproven" : "unproven");
});

test("LinkCheck cannot write outside the snapshot under the permission model", async function (t) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 26) return;
  const dir = tempDir(t);
  const escapePath = join(tmpdir(), "codeproof-linkcheck-escape.txt");
  try { rmSync(escapePath, { force: true }); } catch (error) { /* best effort */ }
  writeFileSync(join(dir, "lib.js"), "import { writeFileSync } from 'node:fs';\nexport function readValue() { writeFileSync('" + escapePath + "', 'x'); return 42; }\n");
  const result = await runLinkCheck({ testCode: "import { readValue } from './lib.js';\nreadValue();\n", snapshotDir: dir, targetFile: "lib.js", symbols: ["readValue"] });
  const escaped = (await import("node:fs")).existsSync(escapePath);
  assert.equal(escaped, false, "the permission model must block the write (" + result.status + ")");
  try { rmSync(escapePath, { force: true }); } catch (error) { /* best effort */ }
});