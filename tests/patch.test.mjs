import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPatchToSnapshot, attemptPatch, runPatchGate, unifiedDiff, validatePatchL0 } from "../src/patch/index.mjs";
import { prepareSnapshot } from "../src/repro/index.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function gitHead() {
  return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-patch-test-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function tempRepo(t) {
  const dir = tempDir(t);
  writeFileSync(join(dir, "lib.js"), [
    "export function page(items, number, size) {",
    "  const start = number * size;",
    "  return items.slice(start, start + size + 1);",
    "}",
    ""
  ].join("\n"));
  writeFileSync(join(dir, "other.js"), "export const other = 1;\n");
  return dir;
}

function finding(paths) {
  return { id: "F-001", title: "Off-by-one page slice", claim: "the page slice returns one extra item", evidence: paths.map(function (path) { return { path: path, startLine: 3, endLine: 3, snippet: "return items.slice(start, start + size + 1);" }; }) };
}

function patchResponse(overrides) {
  return Object.assign({
    findingId: "F-001",
    kind: "patch",
    targetFile: "lib.js",
    searchBlock: "  return items.slice(start, start + size + 1);",
    replaceBlock: "  return items.slice(start, start + size);",
    rationale: "the slice end is exclusive so the extra +1 leaks one item",
    unsupportedReason: ""
  }, overrides || {});
}

test("validatePatchL0 accepts a minimal patch on a cited file", function (t) {
  const dir = tempRepo(t);
  const checked = validatePatchL0(patchResponse(), { finding: finding(["lib.js"]), snapshotDir: dir });
  assert.equal(checked.ok, true, checked.errors.join("; "));
});

test("validatePatchL0 rejects a target that is not one of the cited files", function (t) {
  const dir = tempRepo(t);
  const checked = validatePatchL0(patchResponse(), { finding: finding(["other.js"]), snapshotDir: dir });
  assert.equal(checked.ok, false);
  assert.match(checked.errors.join(" "), /not one of the finding's cited files/);
});

test("validatePatchL0 protects tests, fixtures, reports, manifests and markdown", function (t) {
  const dir = tempRepo(t);
  for (const path of ["tests/x.js", "bench/x.js", "fixtures/x.js", "reports/x.js", ".github/x.yml", "package.json", "package-lock.json", "README.md", ".env"]) {
    const error = validatePatchL0(patchResponse({ targetFile: path }), { finding: finding([path]), snapshotDir: dir });
    assert.equal(error.ok, false, path);
  }
});

test("validatePatchL0 requires a unique searchBlock", function (t) {
  const dir = tempRepo(t);
  writeFileSync(join(dir, "lib.js"), "export const a = 1;\nexport const b = 1;\n");
  const checked = validatePatchL0(patchResponse({ searchBlock: "= 1;", replaceBlock: "= 2;" }), { finding: finding(["lib.js"]), snapshotDir: dir });
  assert.equal(checked.ok, false);
  assert.match(checked.errors.join(" "), /exactly once/);
});

test("validatePatchL0 rejects oversized blocks and API changes", function (t) {
  const dir = tempRepo(t);
  const big = Array.from({ length: 30 }, function (_, index) { return "line " + index; }).join("\n");
  const oversized = validatePatchL0(patchResponse({ searchBlock: big, replaceBlock: big + "\nline 30" }), { finding: finding(["lib.js"]), snapshotDir: dir });
  assert.equal(oversized.ok, false);
  assert.match(oversized.errors.join(" "), /exceeds 25 lines/);
  const apiChange = validatePatchL0(patchResponse({ searchBlock: "export function page(items, number, size) {", replaceBlock: "export function paginate(items, number, size) {" }), { finding: finding(["lib.js"]), snapshotDir: dir });
  assert.equal(apiChange.ok, false);
  assert.match(apiChange.errors.join(" "), /exported names/);
});

test("validatePatchL0 handles unsupported answers and overfitting warnings", function (t) {
  const dir = tempRepo(t);
  const unsupported = validatePatchL0({ findingId: "F-001", kind: "unsupported", targetFile: "", searchBlock: "", replaceBlock: "", rationale: "no safe patch", unsupportedReason: "needs a redesign of the pagination contract" }, { finding: finding(["lib.js"]) });
  assert.equal(unsupported.ok, true, unsupported.errors.join("; "));
  const withCode = validatePatchL0({ findingId: "F-001", kind: "unsupported", targetFile: "lib.js", searchBlock: "x", replaceBlock: "y", rationale: "r", unsupportedReason: "a long enough reason" }, { finding: finding(["lib.js"]) });
  assert.equal(withCode.ok, false);
  const warn = validatePatchL0(patchResponse({ replaceBlock: "  return items.slice(start, start + size) + '12345';" }), { finding: finding(["lib.js"]), snapshotDir: dir, testCode: "assert.equal(page([], 0, 2), '12345');" });
  assert.equal(warn.ok, true, warn.errors.join("; "));
  assert.equal(warn.warnings.length, 1);
  assert.match(warn.warnings[0], /overfitting/);
});

test("applyPatchToSnapshot replaces exactly once and unifiedDiff records the change", function (t) {
  const dir = tempRepo(t);
  const applied = applyPatchToSnapshot({ snapshotDir: dir, targetFile: "lib.js", searchBlock: "  return items.slice(start, start + size + 1);", replaceBlock: "  return items.slice(start, start + size);" });
  assert.match(applied.after, /items.slice\(start, start \+ size\);/);
  assert.equal(applied.after.indexOf("+ 1"), -1);
  const diff = unifiedDiff(applied.before, applied.after, { label: "lib.js" });
  assert.match(diff, /^--- a\/lib\.js/m);
  assert.match(diff, /^-  return items\.slice/m);
  assert.match(diff, /^\+  return items\.slice\(start, start \+ size\);/m);
  assert.equal(unifiedDiff("a\nb\n", "a\nb\n"), "");
});

test("runPatchGate proves the differential result on the demo fixture", async function (t) {
  const workDir = tempDir(t);
  const commit = gitHead();
  const snapshot = prepareSnapshot({ root: join(repoRoot, "fixtures/mini-repo"), commit: commit, workDir: workDir });
  t.after(function () { snapshot.cleanup(); });
  assert.equal(snapshot.available, true, snapshot.reason);
  const controlCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst empty = page([], 0, 2);\nassert.deepEqual(empty, []);\n";
  const testCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst firstPage = page([1, 2, 3, 4, 5], 0, 2);\nassert.deepEqual(firstPage, [1, 2]);\n";
  const proven = await runPatchGate({ snapshotDir: snapshot.snapshotDir, targetFile: "src/pagination.js", searchBlock: "  return items.slice(start, start + size + 1);", replaceBlock: "  return items.slice(start, start + size);", controlCode: controlCode, testCode: testCode, workDir: workDir, attempts: 1 });
  assert.equal(proven.status, "patch-proven", proven.reason);
  assert.equal(proven.control.classification, "passed");
  assert.equal(proven.trigger.classification, "passed");
  assert.match(proven.diff, /^\+  return items\.slice\(start, start \+ size\);/m);
  const wrong = await runPatchGate({ snapshotDir: snapshot.snapshotDir, targetFile: "src/pagination.js", searchBlock: "  return items.slice(start, start + size + 1);", replaceBlock: "  return items.slice(start, start + size + 2);", controlCode: controlCode, testCode: testCode, workDir: workDir, attempts: 1 });
  assert.equal(wrong.status, "rejected");
  assert.match(wrong.reason, /trigger still fails/);
});

test("attemptPatch records patch-proven and unsupported through a fake agent", async function (t) {
  const workDir = tempDir(t);
  const commit = gitHead();
  const snapshot = prepareSnapshot({ root: join(repoRoot, "fixtures/mini-repo"), commit: commit, workDir: workDir });
  t.after(function () { snapshot.cleanup(); });
  const controlCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst empty = page([], 0, 2);\nassert.deepEqual(empty, []);\n";
  const testCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst firstPage = page([1, 2, 3, 4, 5], 0, 2);\nassert.deepEqual(firstPage, [1, 2]);\n";
  const finding = { id: "F-001", title: "Off-by-one page slice", claim: "page returns one extra item", evidence: [{ path: "src/pagination.js", startLine: 3, endLine: 3, snippet: "x" }] };
  const agent = { async complete(request) { assert.equal(request.role, "patcher"); return { text: JSON.stringify(patchResponse({ targetFile: "src/pagination.js" })), model: "fake-patcher", usage: { inputTokens: 10, outputTokens: 20 }, costUsd: 0.01 }; } };
  const result = await attemptPatch({ finding: finding, agent: agent, repoRoot: repoRoot, controlCode: controlCode, testCode: testCode, snapshotDir: snapshot.snapshotDir, config: { reproWorkDir: workDir } });
  assert.equal(result.status, "patch-proven", result.reason);
  assert.equal(result.model, "fake-patcher");
  assert.match(result.diff, /^\+  return items\.slice\(start, start \+ size\);/m);
  assert.equal(typeof result.searchBlockSha256, "string");
  const unsupported = { async complete() { return { text: JSON.stringify({ findingId: "F-001", kind: "unsupported", targetFile: "", searchBlock: "", replaceBlock: "", rationale: "no safe patch", unsupportedReason: "the fix needs a contract change we cannot make surgically" }), model: "fake" }; } };
  const skipped = await attemptPatch({ finding: finding, agent: unsupported, repoRoot: repoRoot, controlCode: controlCode, testCode: testCode, snapshotDir: snapshot.snapshotDir, config: { reproWorkDir: workDir } });
  assert.equal(skipped.status, "unsupported");
  assert.match(skipped.reason, /contract change/);
});

test("attemptPatch passes budget failures through", async function () {
  const error = new Error("budget exceeded");
  error.code = "BUDGET_EXCEEDED";
  const agent = { async complete() { throw error; } };
  await assert.rejects(attemptPatch({ finding: { id: "F-001", evidence: [] }, agent: agent, repoRoot: repoRoot, controlCode: "", testCode: "", snapshotDir: null }), function (received) { return received === error; });
});