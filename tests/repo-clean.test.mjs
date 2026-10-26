import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoIsClean } from "../src/run/index.mjs";

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-clean-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "hello\n");
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

test("repoIsClean reports a clean working tree", async function () {
  const dir = makeRepo();
  assert.equal(await repoIsClean(dir), true);
});

test("repoIsClean detects an unstaged change", async function () {
  const dir = makeRepo();
  writeFileSync(join(dir, "file.txt"), "changed\n");
  assert.equal(await repoIsClean(dir), false);
});

test("repoIsClean detects an untracked file", async function () {
  const dir = makeRepo();
  writeFileSync(join(dir, "new.txt"), "new\n");
  assert.equal(await repoIsClean(dir), false);
});

test("repoIsClean returns false outside a git repository", async function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-nogit-"));
  assert.equal(await repoIsClean(dir), false);
});
