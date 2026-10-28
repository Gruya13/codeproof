import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.mjs";
import { handleMessage, TOOLS } from "../src/mcp/index.mjs";
import { classifyReproRun, validateReproL0 } from "../src/repro/index.mjs";
import { buildReport } from "../src/synthesize/index.mjs";
import { buildVerifierContext } from "../src/verify/context.mjs";
import { applyVerdict, isSnippetInExcerpts } from "../src/verify/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-hardening-b-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

test("L3 rejects manual throw and recognizes only a real node:assert failure", function () {
  const controlCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst got = page([], 0, 2);\nassert.deepEqual(got, []);";
  const testCode = "import assert from 'node:assert/strict';\nimport { page } from './src/pagination.js';\nconst got = page([1, 2, 3], 0, 2);\nassert.deepEqual(got, [1, 2]);";
  const response = { findingId: "F-001", kind: "test", controlCode, testCode,
    expectedBehavior: "page returns exactly two items", rationale: "the returned page must have the requested size", unsupportedReason: "" };
  assert.equal(validateReproL0(response).ok, true);
  const fakeCode = testCode + "\nthrow new Error('AssertionError');";
  assert.match(validateReproL0({ ...response, testCode: fakeCode }).errors.join(" "), /must not throw explicitly/);
  const fake = new Error("AssertionError");
  assert.equal(classifyReproRun({ exitCode: 1, stderr: fake.stack }), "error");
  let real;
  try { assert.equal(1, 2); } catch (error) { real = error; }
  assert.match(real.stack, /^AssertionError \[ERR_ASSERTION\]:/);
  assert.equal(classifyReproRun({ exitCode: 1, stderr: real.stack }), "assertion-failure");
});

test("L2 requires counter-citation in its declared file and line range", function (t) {
  const dir = tempDir(t);
  writeFileSync(join(dir, "a.js"), "const query = request.query;\nexport const safe = true;\n");
  writeFileSync(join(dir, "b.js"), "export const safe = true;\n");
  const repo = { root: dir, manifest: new Map([["a.js", {}], ["b.js", {}]]) };
  const finding = { id: "F-001", evidence: [{ path: "a.js", startLine: 1, endLine: 1, snippet: "const query = request.query;" }] };
  const excerpts = "### a.js - cited file\n   1 | const query = request.query;\n   2 | export const safe = true;";
  const counter = { path: "b.js", startLine: 1, endLine: 1, snippet: "export const safe = true;" };
  const verdict = { findingId: "F-001", verdict: "refute", mode: "strong", reason: "unrelated line", counterEvidence: [counter] };
  const result = applyVerdict(verdict, "fake", repo, finding, excerpts);
  assert.equal(result.verifier.counterEvidenceL1.passed, true);
  assert.equal(result.verifier.counterEvidencePolicy.inContext, false);
  assert.equal(result.status, "moderate");
  assert.equal(isSnippetInExcerpts(counter.snippet, "### b.js\n   2 | export const safe = true;", counter), false);
  assert.equal(isSnippetInExcerpts(counter.snippet, "### b.js\n   1 | export const safe = true;", counter), true);
});

test("L2 context includes every cited file, separate ranges and the first 30 lines", function (t) {
  const dir = tempDir(t);
  const files = [];
  const evidence = [];
  for (const [name, lineNumbers] of [["a.js", [250, 400]], ["b.js", [350]]]) {
    const lines = Array.from({ length: 450 }, function (_, index) { return "export const line" + (index + 1) + " = " + (index + 1) + ";"; });
    writeFileSync(join(dir, name), lines.join("\n"));
    files.push({ path: name, loc: 450 });
    for (const lineNumber of lineNumbers) evidence.push({ path: name, startLine: lineNumber, endLine: lineNumber, snippet: lines[lineNumber - 1] });
  }
  const repo = { root: dir, files, edges: [], cycles: [], loc: 900 };
  const context = buildVerifierContext({ repo, finding: { id: "F-001", claim: "two distinct cited lines", evidence }, maxChars: 24000 });
  for (const item of evidence) {
    assert.ok(context.segments.some(function (segment) { return segment.path === item.path && segment.startLine <= item.startLine && segment.endLine >= item.endLine; }), item.path);
    assert.ok(context.segments.some(function (segment) { return segment.path === item.path && segment.startLine === 1 && segment.endLine >= 30; }), item.path + " header");
    assert.equal(isSnippetInExcerpts(item.snippet, context, item), true);
  }
});

test("L3 config clamps attempts and report prints recorded counts", function () {
  assert.equal(loadConfig({ REPRO_ATTEMPTS: "1" }).reproAttempts, 3);
  assert.equal(loadConfig({ REPRO_ATTEMPTS: "20" }).reproAttempts, 10);
  const finding = { id: "F-001", title: "A page length error", claim: "The page has too many items", severity: "high",
    evidence: [{ path: "a.js", startLine: 1, endLine: 1, snippet: "const a = 1;" }] };
  const runs = Array.from({ length: 4 }, function () { return { stderr: "AssertionError [ERR_ASSERTION]: failed" }; });
  const repro = { status: "reproduced", controlCode: "control()", testCode: "trigger()", attempts: runs,
    control: { attempts: runs }, trigger: { attempts: runs }, linkcheck: { status: "proven" } };
  const run = { repo: { commit: "abc" }, runId: "test", mode: "smoke", calls: 0, retries: 0,
    findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 },
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false }, repro: { enabled: true, attempts: 4 } };
  const report = buildReport({ repo: { files: [], loc: 0, edges: [], cycles: [] }, published: [{ finding, status: "verified", verifier: { model: "fake", verdict: "confirm", reason: "yes" }, repro }], run });
  assert.match(report, /control passed 4\/4 and the trigger failed 4\/4/);
  assert.doesNotMatch(report, /3\/3/);
});

test("MCP scan rejects mock:false and advertises an offline contract", async function () {
  const scan = TOOLS.find(function (tool) { return tool.name === "codeproof_scan"; });
  assert.match(scan.description, /mock adapter only.*no network/);
  const response = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "codeproof_scan", arguments: { path: ".", mock: false } } });
  assert.equal(response.error.code, -32603);
  assert.match(response.error.message, /mock:false is not allowed/);
});

test("Proof Explorer escapes HTML text and attribute metacharacters", function () {
  const html = readFileSync(join(root, "docs/index.html"), "utf8");
  assert.match(html, /replace\(\/\[&<>"'\]\/g/);
  for (const entity of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) assert.ok(html.includes(entity), entity);
  assert.match(html, /esc\(ev\.startLine\).*esc\(ev\.endLine\)/);
  assert.match(html, /esc\(step\[1\]\)/);
  assert.match(html, /esc\(coverage\.filesInPrompt\).*esc\(coverage\.filesTotal\)/);
});
