import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingest/index.mjs";

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
