import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCitation } from "../src/verify/index.mjs";
import { buildReport } from "../src/synthesize/index.mjs";

const manifest = new Map([["src/a.ts", { path: "src/a.ts" }]]);

function makeGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-provenance-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "const a = 1;\nconst b = 2;\nconst c = 3;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "init"], { cwd: dir });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  return { dir: dir, commit: commit };
}

test("L1 reads citations from the run commit, not from a modified working tree", function () {
  const { dir, commit } = makeGitRepo();
  writeFileSync(join(dir, "src/a.ts"), "const x = 10;\nconst y = 20;\nconst z = 30;\n");
  const repo = { root: dir, manifest: manifest, commit: commit };
  const committed = checkCitation({ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "const b = 2;" }, repo);
  assert.equal(committed.passed, true, committed.reason);
  const workingTree = checkCitation({ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "const y = 20;" }, repo);
  assert.equal(workingTree.passed, false);
});

test("L1 reads the working tree when no commit is given", function () {
  const { dir } = makeGitRepo();
  writeFileSync(join(dir, "src/a.ts"), "const x = 10;\nconst y = 20;\nconst z = 30;\n");
  const repo = { root: dir, manifest: manifest };
  const result = checkCitation({ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "const y = 20;" }, repo);
  assert.equal(result.passed, true, result.reason);
});

test("L1 rejects a file added after the analyzed commit", function () {
  const { dir, commit } = makeGitRepo();
  try {
    writeFileSync(join(dir, "src/b.ts"), "const b = 2;\n");
    execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
    execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "add b"], { cwd: dir });
    const repo = { root: dir, manifest: new Map([["src/b.ts", { path: "src/b.ts" }]]), commit: commit };
    const result = checkCitation({ path: "src/b.ts", startLine: 1, endLine: 1, snippet: "const b = 2;" }, repo);
    assert.equal(result.passed, false);
    assert.match(result.reason, /not present in the analyzed commit/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("L1 falls back to disk when the target is not a git repository", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-nogit-prov-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "hello\nworld\n");
  const repo = { root: dir, manifest: manifest, commit: "0123456789abcdef0123456789abcdef01234567" };
  const result = checkCitation({ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "world" }, repo);
  assert.equal(result.passed, true, result.reason);
});

test("T-B9: a CRLF file in the commit matches a LF citation through line normalisation", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-provenance-crlf-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "const a = 1;\r\nconst b = 2;\r\nconst c = 3;\r\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "crlf"], { cwd: dir });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  const repo = { root: dir, manifest: manifest, commit: commit };
  const lfCitation = checkCitation({ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "const b = 2;" }, repo);
  assert.equal(lfCitation.passed, true, lfCitation.reason);
});

test("report prints the committed source lines instead of a model-provided snippet", function () {
  const { dir, commit } = makeGitRepo();
  try {
    const finding = {
      id: "F-001", severity: "high", title: "Incorrect second line",
      claim: "The second line produces an incorrect result.",
      evidence: [{ path: "src/a.ts", startLine: 2, endLine: 2, snippet: "const b = 999;" }]
    };
    const report = buildReport({
      repo: { files: [{ path: "src/a.ts" }], loc: 3, edges: [], cycles: [] },
      repoRoot: dir,
      published: [{ finding, status: "verified", verifier: { model: "test", verdict: "confirm", reason: "test" } }],
      run: { repo: { path: dir, commit }, runId: "test", mode: "smoke", findings: { proposed: 1, l1Rejected: 0, verified: 1, moderate: 0, refuted: 0, uncertain: 0 }, calls: 0, retries: 0, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, measured: false } }
    });
    assert.match(report, /Citation \(from commit, lines 2-2\)/);
    assert.match(report, /const b = 2;/);
    assert.doesNotMatch(report, /const b = 999;/);
    assert.match(report, /Evidence level:\*\* citation-proven \+ adversarially-confirmed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
