import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REPRO_RESPONSE_FORMAT,
  REPRO_SYSTEM_PROMPT,
  attemptRepro,
  buildReproMessages,
  classifyReproRun,
  parseReproResponse,
  prepareSnapshot,
  runReproTest,
  validateReproL0
} from "../src/repro/index.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const failingCode = "import assert from 'node:assert/strict';\nassert.equal(1, 2);\n";
const passingCode = "import assert from 'node:assert/strict';\nassert.equal(1, 1);\n";

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
  return dir;
}

function reproResponse(testCode = failingCode) {
  return {
    findingId: "F-001", kind: "test", testCode,
    expectedBehavior: "The function should return the documented correct result.",
    rationale: "The assertion exercises the affected branch directly.",
    unsupportedReason: ""
  };
}

test("reproducer schema and parser accept a valid test", function () {
  const format = REPRO_RESPONSE_FORMAT.json_schema.schema;
  assert.deepEqual(format.required, ["findingId", "kind", "testCode", "expectedBehavior", "rationale", "unsupportedReason"]);
  assert.equal(format.additionalProperties, false);
  assert.match(REPRO_SYSTEM_PROMPT, /unsupported/);
  assert.deepEqual(parseReproResponse(JSON.stringify(reproResponse())), reproResponse());
  assert.equal(validateReproL0(reproResponse()).ok, true);
});

test("reproducer L0 rejects absent assertions, forbidden code and long tests", function () {
  assert.match(validateReproL0(reproResponse("export const x = 1;")).errors.join(" "), /node:assert/);
  for (const code of ["assert.fail()", "process.exit(1)", "require('x')", "fetch('x')", "http://example.com", "node:net", "node:http", "node:https", "child_process", "writeFileSync('x', 'y')"]) {
    const result = validateReproL0(reproResponse("import assert from 'node:assert/strict';\n" + code));
    assert.equal(result.ok, false, code);
  }
  assert.match(validateReproL0(reproResponse("import assert from 'node:assert/strict';\n" + "assert.ok(true);\n".repeat(60))).errors.join(" "), /60 lines/);
  assert.equal(validateReproL0({ ...reproResponse(), findingId: "bad" }).ok, false);
  assert.equal(validateReproL0({ ...reproResponse(), extra: true }).ok, false);
});

test("unsupported response needs a reason and no code", function () {
  const unsupported = { ...reproResponse(""), kind: "unsupported", unsupportedReason: "The DOM is not available in the repository." };
  assert.equal(validateReproL0(unsupported).ok, true);
  assert.equal(validateReproL0({ ...unsupported, testCode: failingCode }).ok, false);
  assert.equal(validateReproL0({ ...unsupported, unsupportedReason: "short" }).ok, false);
});

test("run classifier separates assertions, success, syntax, timeout, sandbox and permission errors", function () {
  assert.equal(classifyReproRun({ exitCode: 1, stderr: "AssertionError [ERR_ASSERTION]" }), "assertion-failure");
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
