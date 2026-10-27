import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filesWithLineNumbers, ingest } from "../src/ingest/index.mjs";

function write(dir, relativePath, content) {
  const full = join(dir, relativePath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

test("ingest uses tracked git files and ignores build artifacts and node_modules", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-ingest-git-"));
  write(dir, "src/a.ts", "const a = 1;\nconst b = 2;\n");
  write(dir, "README.md", "# fixture\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "init"], { cwd: dir });
  write(dir, "dist/a.js", "const a = 1;\n");
  write(dir, "dist/a.d.ts", "export declare const a: number;\n");
  write(dir, "node_modules/pkg/index.js", "module.exports = {};\n");
  const result = ingest(dir);
  assert.deepEqual(result.files.map(function (file) { return file.path; }), ["src/a.ts"]);
  assert.equal(result.loc, 2);
});

function commitAll(dir, message) {
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", message || "init"], { cwd: dir });
  return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

test("ingest reads the analyzed commit, so a dirty working tree does not change the analysis", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-ingest-commit-"));
  write(dir, "src/a.js", "export const value = 1;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const commit = commitAll(dir);
  // change the file AFTER the commit: ingestion must still see the committed bytes
  write(dir, "src/a.js", "export const value = 2;\n");
  const result = ingest(dir, { commit: commit });
  assert.equal(result.commit, commit);
  assert.match(result.sources.get("src/a.js"), /value = 1/);
  assert.match(filesWithLineNumbers(result), /value = 1/);
  assert.doesNotMatch(filesWithLineNumbers(result), /value = 2/);
  // without a commit the working tree is used (mock/demo path)
  const workingTree = ingest(dir);
  assert.equal(workingTree.commit, null);
  assert.match(workingTree.sources.get("src/a.js"), /value = 2/);
});

test("ingest reads a scoped subdirectory from the commit, not the repository root", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-ingest-scope-"));
  write(dir, "src/a.js", "export const value = 1;\n");
  write(dir, "other/b.js", "export const other = 2;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const commit = commitAll(dir);
  const scoped = ingest(join(dir, "src"), { commit: commit });
  assert.deepEqual(scoped.files.map(function (file) { return file.path; }), ["a.js"]);
  assert.match(scoped.sources.get("a.js"), /value = 1/);
});

test("ingest counts an empty file as 0 lines, not 1", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-ingest-empty-"));
  write(dir, "src/empty.js", "");
  write(dir, "src/one.js", "const one = 1;\n");
  const result = ingest(dir);
  const byPath = new Map(result.files.map(function (file) { return [file.path, file.loc]; }));
  assert.equal(byPath.get("src/empty.js"), 0);
  assert.equal(byPath.get("src/one.js"), 1);
});

test("ingest falls back to walking and skips build directories when the target is not a git repository", function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-ingest-walk-"));
  write(dir, "src/a.ts", "const a = 1;\n");
  write(dir, "src/b.js", "const b = 2;\n");
  write(dir, "dist/c.js", "const c = 3;\n");
  write(dir, "node_modules/pkg/index.js", "module.exports = {};\n");
  write(dir, "coverage/report.js", "const coverage = 1;\n");
  const result = ingest(dir);
  assert.deepEqual(result.files.map(function (file) { return file.path; }), ["src/a.ts", "src/b.js"]);
});
