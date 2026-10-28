import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REPRO_RESPONSE_FORMAT,
  REPRO_SYSTEM_PROMPT,
  attemptRepro,
  buildReproMessages,
  classifyReproRun,
  extractImportedIdentifiers,
  extractReproImports,
  isInternalImportFailure,
  parseReproResponse,
  prepareSnapshot,
  runReproTest,
  validateReproL0
} from "../src/repro/index.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const failingCode = "import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\nconst got = compute(2);\nassert.equal(got, 7);\n";
const passingCode = "import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\nconst got = compute(1);\nassert.equal(got, 2);\n";
const selfContainedCode = "import assert from 'node:assert/strict';\nassert.equal(1, 2);\n";

// A generated control that satisfies the two-phase rules for an arbitrary trigger: same import,
// same symbol, a different argument, and the assertion tied to the returned value.
function controlFor(testCode) {
  const spec = extractReproImports(testCode)[0];
  const ids = extractImportedIdentifiers(testCode);
  const called = ids.find(function (id) { return new RegExp("\\b" + id + "\\s*\\(").test(testCode); });
  if (!spec || !called) return passingCode;
  return "import assert from 'node:assert/strict';\nimport { " + called + " } from '" + spec + "';\nconst controlValue = " + called + "(0);\nassert.ok(controlValue !== undefined);\n";
}

function gitHead() {
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch (error) {
    if (error.code === "EPERM" && error.status === 0 && error.pid) return String(error.stdout).trim();
    throw error;
  }
}

function tempSnapshot(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-repro-test-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  writeFileSync(join(dir, "sample.js"), "export const value = 42;\nexport function compute(n) { return n + 1; }\n", "utf8");
  return dir;
}

function reproResponse(testCode = failingCode, controlCode = controlFor(testCode)) {
  return {
    findingId: "F-001", kind: "test", controlCode, testCode,
    expectedBehavior: "The function should return the documented correct result.",
    rationale: "The assertion exercises the affected branch directly.",
    unsupportedReason: ""
  };
}

test("reproducer schema and parser accept a valid test", function () {
  const format = REPRO_RESPONSE_FORMAT.json_schema.schema;
  assert.deepEqual(format.required, ["findingId", "kind", "controlCode", "testCode", "expectedBehavior", "rationale", "unsupportedReason"]);
  assert.equal(format.additionalProperties, false);
  assert.match(REPRO_SYSTEM_PROMPT, /unsupported/);
  assert.deepEqual(parseReproResponse(JSON.stringify(reproResponse())), reproResponse());
  assert.equal(validateReproL0(reproResponse()).ok, true);
});

test("reproducer L0 rejects absent assertions, forbidden code and long tests", function () {
  assert.match(validateReproL0(reproResponse("export const x = 1;")).errors.join(" "), /node:assert/);
  for (const code of ["assert.fail()", "process.exit(1)", "require('x')", "fetch('x')", "node:net", "node:http", "node:https", "child_process", "writeFileSync('x', 'y')", "console.error('AssertionError')", "process.stderr.write('x')"]) {
    const result = validateReproL0(reproResponse("import assert from 'node:assert/strict';\n" + code));
    assert.equal(result.ok, false, code);
  }
  assert.match(validateReproL0(reproResponse("import assert from 'node:assert/strict';\n" + "assert.ok(true);\n".repeat(60))).errors.join(" "), /45 lines/);
  assert.equal(validateReproL0({ ...reproResponse(), findingId: "bad" }).ok, false);
  assert.equal(validateReproL0({ ...reproResponse(), extra: true }).ok, false);
});

test("a URL string as test data does not trip the static validator", function () {
  const code = "import assert from 'node:assert/strict';\nimport { parseURL } from './sample.js';\nassert.equal(typeof parseURL('https://example.com/a?b=1'), 'object');\n";
  const result = validateReproL0(reproResponse(code));
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("L0 requires an assertion and a call to an imported repository symbol", function () {
  const noAssertion = validateReproL0(reproResponse("import assert from 'node:assert/strict';\nimport { value } from './sample.js';\n"));
  assert.equal(noAssertion.ok, false);
  assert.match(noAssertion.errors.join(" "), /at least one node:assert assertion/);
  const unusedImport = validateReproL0(reproResponse("import assert from 'node:assert/strict';\nimport { value } from './sample.js';\nassert.equal(1, 2);"));
  assert.equal(unusedImport.ok, false);
  assert.match(unusedImport.errors.join(" "), /call an imported repository symbol/);
  const valid = validateReproL0(reproResponse("import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\nconst got = compute(1);\nassert.equal(got, 2);"));
  assert.equal(valid.ok, true, valid.errors.join("; "));
  assert.deepEqual(extractImportedIdentifiers("import { a, b as c } from './x.js';\nimport d from './y.js';\nimport * as ns from './z.js';").sort(), ["a", "c", "d", "ns"]);
  // a multi-line import must not leave its continuation lines in the body
  const multiline = "import assert from 'node:assert/strict';\nimport {\n  alphaSymbol,\n  betaSymbol\n} from './sample.js';\nassert.ok(true);";
  const multilineResult = validateReproL0(reproResponse(multiline));
  assert.equal(multilineResult.ok, false);
  assert.match(multilineResult.errors.join(" "), /call an imported repository symbol/);
});

test("L0 rejects non-deterministic and ambient constructs", function () {
  const base = "import assert from 'node:assert/strict';\nimport { value } from './sample.js';\n";
  for (const snippet of ["const n = Math.random();", "const n = Date.now();", "const n = new Date();", "const n = performance.now();", "const n = process.env.HOME;"]) {
    const result = validateReproL0(reproResponse(base + snippet + "\nassert.equal(value, 7);"));
    assert.equal(result.ok, false, snippet);
  }
  const deterministic = validateReproL0(reproResponse("import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\nconst got = compute(1);\nconst n = 42;\nassert.equal(got, 2);\nassert.equal(n, 42);"));
  assert.equal(deterministic.ok, true, deterministic.errors.join("; "));
});

test("L0 rejects trivial assertions that would pass or fail without the code", function () {
  const base = "import assert from 'node:assert/strict';\nimport { value } from './sample.js';\nassert.equal(value, 7);\n";
  for (const line of ["assert.ok(true);", "assert.equal(1, 1);", "assert.equal(true, true);"]) {
    const result = validateReproL0(reproResponse(base + line));
    assert.equal(result.ok, false, line);
  }
});

test("internal import failures are detected for ESM and CommonJS repositories", function () {
  const esm = { classification: "invalid-test", attempts: [{ stderr: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/tmp/snapshot/_utils'" }] };
  assert.equal(isInternalImportFailure(esm), true);
  const cjs = { classification: "invalid-test", attempts: [{ stderr: "Error: Cannot find module 'picocolors'\nRequire stack:\n- /tmp/snapshot/css-syntax-error.js" }] };
  assert.equal(isInternalImportFailure(cjs), true);
  const testImport = { classification: "invalid-test", attempts: [{ stderr: "Cannot find module 'x' imported from .codeproof-repro.test.mjs" }] };
  assert.equal(isInternalImportFailure(testImport), false);
  assert.equal(isInternalImportFailure({ classification: "assertion-failure", attempts: [{ stderr: "Cannot find module" }] }), false);
  assert.equal(isInternalImportFailure(null), false);
});

test("unsupported response needs a reason and no code", function () {
  const unsupported = { ...reproResponse(""), kind: "unsupported", controlCode: "", unsupportedReason: "The DOM is not available in the repository." };
  assert.equal(validateReproL0(unsupported).ok, true);
  assert.equal(validateReproL0({ ...unsupported, testCode: failingCode }).ok, false);
  assert.equal(validateReproL0({ ...unsupported, unsupportedReason: "short" }).ok, false);
});

test("run classifier separates assertions, success, syntax, timeout, sandbox and permission errors", function () {
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:" }), "assertion-failure");
  assert.equal(classifyReproRun({ exitCode: 0, stderr: "" }), "passed");
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "SyntaxError: Unexpected token" }), "invalid-test");
  assert.equal(classifyReproRun({ exitCode: null, killed: true, signal: "SIGTERM" }), "timeout");
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "network disabled in repro sandbox" }), "sandbox-blocked");
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "ERR_ACCESS_DENIED" }), "invalid-test");
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "Unexpected error" }), "error");
});

test("runner classifies a failing assertion and three identical failures as deterministic", async function (t) {
  const dir = tempSnapshot(t);
  const result = await runReproTest({ testCode: failingCode, snapshotDir: dir });
  assert.equal(result.classification, "assertion-failure");
  assert.equal(result.deterministic, true);
  assert.equal(result.attempts.length, 3);
  assert.equal(existsSync(join(dir, ".codeproof-repro.test.mjs")), false);
  assert.equal(existsSync(join(dir, ".codeproof-repro-guard.mjs")), false);
});

test("runner classifies a passing assertion", async function (t) {
  const result = await runReproTest({ testCode: passingCode, snapshotDir: tempSnapshot(t), attempts: 1 });
  assert.equal(result.classification, "passed");
  assert.equal(result.deterministic, false);
});

test("runner classifies invalid syntax", async function (t) {
  const result = await runReproTest({ testCode: "import assert from 'node:assert/strict';\nconst = ;", snapshotDir: tempSnapshot(t), attempts: 1 });
  assert.equal(result.classification, "invalid-test");
});

test("runner times out an infinite loop", async function (t) {
  const result = await runReproTest({ testCode: "while (true) {}", snapshotDir: tempSnapshot(t), timeoutMs: 150, attempts: 1 });
  assert.equal(result.classification, "timeout");
});

test("runner blocks fetch through the preload guard", async function (t) {
  const result = await runReproTest({ testCode: "await fetch('https://example.invalid');", snapshotDir: tempSnapshot(t), attempts: 1 });
  assert.equal(result.classification, "sandbox-blocked");
});

test("permission model rejects reads outside the snapshot", async function (t) {
  const code = "import { readFileSync } from 'node:fs';\nreadFileSync('/etc/passwd');";
  const result = await runReproTest({ testCode: code, snapshotDir: tempSnapshot(t), attempts: 1 });
  assert.equal(result.classification, "invalid-test");
  assert.equal(result.attempts[0].exitCode === 0, false);
});

test("snapshot contains committed benchmark TypeScript and cleans up", function (t) {
  const workDir = tempSnapshot(t);
  const commit = gitHead();
  const snapshot = prepareSnapshot({ root: join(repoRoot, "bench/seed-repo"), commit, workDir });
  assert.equal(snapshot.available, true, snapshot.reason);
  assert.equal(existsSync(join(snapshot.snapshotDir, "src/validation.ts")), true);
  snapshot.cleanup();
  assert.equal(existsSync(snapshot.snapshotDir), false);
});

test("snapshot returns unavailable for a missing commit", function (t) {
  const snapshot = prepareSnapshot({ root: repoRoot, commit: "no-such-commit", workDir: tempSnapshot(t) });
  assert.equal(snapshot.available, false);
  assert.match(snapshot.reason, /snapshot unavailable/);
});

test("repro messages omit severity and include the cited file and file list", function () {
  const finding = { id: "F-001", title: "Quota boundary", claim: "The inclusive quota boundary is rejected.", severity: "critical", confidence: 0.99,
    evidence: [{ path: "bench/seed-repo/src/quota.ts", startLine: 6, endLine: 6, snippet: "return used + amount < max;" }] };
  const messages = buildReproMessages({ finding, repoRoot, commit: gitHead(), excerpts: "6 | return used + amount < max;" });
  assert.match(messages[1].content, /Cited file/);
  assert.match(messages[1].content, /Repository files:/);
  assert.match(messages[1].content, /bench\/seed-repo\/src\/quota\.ts/);
  assert.equal(/severity|confidence/i.test(messages[1].content), false);
});

test("attemptRepro returns reproduced with a fake agent and writes artifacts", async function (t) {
  const outDir = tempSnapshot(t);
  const workDir = tempSnapshot(t);
  const commit = gitHead();
  const code = "import assert from 'node:assert/strict';\nimport { withinQuota } from './bench/seed-repo/src/quota.ts';\nassert.equal(withinQuota(3, 2, 5), true);\n";
  const agent = { async complete(request) {
    assert.equal(request.role, "repro");
    assert.equal(request.temperature, 0);
    return { text: JSON.stringify(reproResponse(code)), model: "fake-repro", usage: { inputTokens: 10, outputTokens: 20 }, costUsd: 0 };
  } };
  const finding = { id: "F-001", title: "Quota boundary", claim: "The inclusive quota boundary is rejected.",
    evidence: [{ path: "bench/seed-repo/src/quota.ts", startLine: 6, endLine: 6, snippet: "return used + amount < max;" }] };
  const result = await attemptRepro({ finding, agent, repoRoot, commit, excerpts: "6 | return used + amount < max;", config: { reproWorkDir: workDir }, outDir });
  assert.equal(result.status, "reproduced", result.reason);
  assert.equal(result.classification, "assertion-failure");
  assert.equal(result.attempts.length, 3);
  assert.equal(readFileSync(result.artifacts.test, "utf8"), code);
  const artifact = JSON.parse(readFileSync(result.artifacts.result, "utf8"));
  assert.equal(artifact.model, "fake-repro");
  assert.equal(artifact.attempts.length, 3);
});

test("attemptRepro returns inconclusive for invalid JSON without throwing", async function (t) {
  const finding = { id: "F-001", title: "Invalid", claim: "This claim has enough words.", evidence: [] };
  const agent = { async complete() { return { text: "invalid json", model: "fake-repro" }; } };
  const result = await attemptRepro({ finding, agent, repoRoot, commit: null, outDir: tempSnapshot(t) });
  assert.equal(result.status, "inconclusive");
  assert.match(result.reason, /no JSON object/);
  assert.equal(existsSync(result.artifacts.result), true);
});

test("attemptRepro passes budget failures through", async function () {
  const error = new Error("budget exceeded");
  error.code = "BUDGET_EXCEEDED";
  const agent = { async complete() { throw error; } };
  await assert.rejects(attemptRepro({ finding: { id: "F-001", evidence: [] }, agent, repoRoot, commit: null }), function (received) { return received === error; });
});

test("L0 rejects a self-contained test that imports no repository code", function () {
  const result = validateReproL0(reproResponse(selfContainedCode));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /must import the analyzed repository code/);
});

test("extractReproImports finds static, side-effect and dynamic relative imports only", function () {
  const code = [
    "import assert from 'node:assert/strict';",
    "import { a } from './src/a.js';",
    "import './src/side-effect.js';",
    "const m = await import('../lib/b.mjs');",
    "import { c } from 'some-package';",
    "import { d } from 'node:fs';"
  ].join("\n");
  assert.deepEqual(extractReproImports(code).sort(), ["../lib/b.mjs", "./src/a.js", "./src/side-effect.js"]);
});

test("L0 rejects direct stream writes that could fake the failure class", function () {
  for (const code of [
    "process.stderr.write('AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:');",
    "process.stdout.write('AssertionError');"
  ]) {
    const result = validateReproL0(reproResponse("import assert from 'node:assert/strict';\nimport { value } from './sample.js';\n" + code));
    assert.equal(result.ok, false, code);
    assert.match(result.errors.join(" "), /direct stream output/);
  }
});

test("attemptRepro refuses a generated test whose import is not in the analyzed snapshot", async function (t) {
  const workDir = tempSnapshot(t);
  const commit = gitHead();
  const code = "import assert from 'node:assert/strict';\nimport { compute } from './does-not-exist.js';\nconst got = compute(1);\nassert.equal(got, 2);\n";
  const agent = { async complete() { return { text: JSON.stringify(reproResponse(code)), model: "fake-repro", usage: { inputTokens: 10, outputTokens: 20 }, costUsd: 0 }; } };
  const finding = { id: "F-001", title: "Quota boundary", claim: "The inclusive quota boundary is rejected.", evidence: [] };
  const result = await attemptRepro({ finding, agent, repoRoot, commit, excerpts: "", config: { reproWorkDir: workDir }, outDir: null });
  assert.equal(result.status, "inconclusive");
  assert.match(result.reason, /not in the analyzed snapshot/);
});

test("attemptRepro retries once when the reproducer call is truncated", async function (t) {
  const workDir = tempSnapshot(t);
  const commit = gitHead();
  const trigger = "import assert from 'node:assert/strict';\nimport { loadConfig } from './src/config.mjs';\nconst c = loadConfig({ MAX_FINDINGS: '3' });\nassert.equal(c.maxFindings, 8);\n";
  const control = "import assert from 'node:assert/strict';\nimport { loadConfig } from './src/config.mjs';\nconst c = loadConfig({});\nassert.equal(c.maxFindings, 8);\n";
  let calls = 0;
  const agent = { async complete() {
    calls += 1;
    if (calls === 1) return { text: "{\"findingId\":\"F-001\",\"kind\":\"test\",\"testCode\":\"", finishReason: "length", model: "fake", usage: { inputTokens: 10, outputTokens: 20, cachedTokens: 0 }, costUsd: 0.01 };
    return { text: JSON.stringify(reproResponse(trigger, control)), finishReason: "stop", model: "fake", usage: { inputTokens: 10, outputTokens: 20, cachedTokens: 0 }, costUsd: 0.02 };
  } };
  const finding = { id: "F-001", title: "Truncated call", claim: "The reproducer answer was truncated.", evidence: [] };
  const result = await attemptRepro({ finding, agent, repoRoot, commit, excerpts: "", config: { reproWorkDir: workDir }, outDir: null });
  assert.equal(calls, 2);
  assert.equal(result.status, "reproduced", result.reason);
});

test("attemptRepro rejects a self-contained test before spending a runner", async function (t) {
  const workDir = tempSnapshot(t);
  const agent = { async complete() { return { text: JSON.stringify(reproResponse(selfContainedCode)), model: "fake-repro" }; } };
  const finding = { id: "F-001", title: "Off-by-one", claim: "The slice end is inclusive.", evidence: [] };
  const result = await attemptRepro({ finding, agent, repoRoot, commit: gitHead(), excerpts: "", config: { reproWorkDir: workDir }, outDir: null });
  assert.equal(result.status, "inconclusive");
  assert.match(result.reason, /must import the analyzed repository code/);
});

test("two-phase L0 requires controlCode and rejects decorative, dead and tautological calls", function () {
  const spec = "import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\n";
  // control missing
  const noControl = validateReproL0({ ...reproResponse(failingCode), controlCode: "" });
  assert.equal(noControl.ok, false);
  assert.match(noControl.errors.join(" "), /controlCode/);
  // decorative call followed by an unrelated assertion
  const decorative = validateReproL0(reproResponse(spec + "compute(1);\nassert.equal(2, 3);\n"));
  assert.equal(decorative.ok, false);
  assert.match(decorative.errors.join(" "), /not tied/);
  // dead-code guard
  const dead = validateReproL0(reproResponse(spec + "if (false) { compute(1); }\nassert.equal(compute(2), 7);\n"));
  assert.equal(dead.ok, false);
  assert.match(dead.errors.join(" "), /dead-code/);
  // tautology
  const tautology = validateReproL0(reproResponse(spec + "const got = compute(1);\nassert.equal(got === got, false);\n"));
  assert.equal(tautology.ok, false);
  assert.match(tautology.errors.join(" "), /tautological/);
});

test("two-phase L0 requires control and trigger to use different arguments and a common symbol", function () {
  const spec = "import assert from 'node:assert/strict';\nimport { compute } from './sample.js';\n";
  const sameInput = validateReproL0(reproResponse(spec + "const got = compute(1);\nassert.equal(got, 7);\n", spec + "const got = compute(1);\nassert.equal(got, 2);\n"));
  assert.equal(sameInput.ok, false);
  assert.match(sameInput.errors.join(" "), /different input/);
  const noCommon = validateReproL0(reproResponse(spec + "const got = compute(1);\nassert.equal(got, 7);\n", "import assert from 'node:assert/strict';\nimport { other } from './other.js';\nconst got = other(0);\nassert.ok(got);\n"));
  assert.equal(noCommon.ok, false);
  assert.match(noCommon.errors.join(" "), /common imported symbol/);
});
