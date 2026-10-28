#!/usr/bin/env node
// Test-lock tool (F0.6, new work in this repo, zero dependencies).
//
// A test set is locked with a sidecar `<test>.lock.json` carrying the sha256 of the test file, the
// git revision that commit it lives in, and the repo-relative path. `check` distinguishes:
//   LOCKED    file hash = casesSha256 AND git show <gitRevision>:<gitRel> hashes to casesSha256
//   CHANGED   the working file differs from the locked hash
//   UNLOCKED  no sidecar
//   UNPROVEN  the sidecar exists but the hash cannot be proven from git (missing/shallow revision)
//
// Because a sidecar cannot contain the hash of the commit that contains it, locking is two commits:
// (A) the test commit, (B) the lock commit with `gitRevision` = A. Relock follows the same pattern
// (A' then B') and appends to `relocks[]` with a mandatory reason.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const LOCK_SCHEMA_VERSION = 1;

export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function lockPathFor(testPath) {
  return resolve(testPath) + ".lock.json";
}

function git(args, options) {
  return execFileSync("git", args, { encoding: (options && options.encoding) || "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function isGitRepo() {
  try { git(["rev-parse", "--git-dir"]); return true; } catch (error) { return false; }
}

export function gitRelPath(testPath) {
  const output = git(["ls-files", "--error-unmatch", "--", resolve(testPath)]);
  return String(output).trim();
}

function headRevision() {
  return String(git(["rev-parse", "HEAD"])).trim();
}

function blobHash(revision, relPath) {
  try {
    const blob = git(["show", revision + ":" + relPath], { encoding: "buffer" });
    return sha256Hex(blob);
  } catch (error) {
    return null;
  }
}

export function checkLock(testPath) {
  const lockPath = lockPathFor(testPath);
  if (!existsSync(lockPath)) return { status: "UNLOCKED", reason: "no sidecar at " + lockPath };
  let lock;
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch (error) { return { status: "UNPROVEN", reason: "sidecar is not valid JSON" }; }
  if (!lock.casesSha256 || !lock.gitRevision || !lock.gitRel) {
    return { status: "UNPROVEN", reason: "sidecar is missing casesSha256/gitRevision/gitRel" };
  }
  let actual;
  try { actual = sha256Hex(readFileSync(testPath)); } catch (error) { return { status: "UNPROVEN", reason: "test file is not readable" }; }
  if (actual !== lock.casesSha256) return { status: "CHANGED", reason: "test file hash differs from the locked hash", lock: lock };
  const fromGit = blobHash(lock.gitRevision, lock.gitRel);
  if (fromGit === null) return { status: "UNPROVEN", reason: "git show " + lock.gitRevision + ":" + lock.gitRel + " failed (missing revision or shallow clone)", lock: lock };
  if (fromGit !== lock.casesSha256) return { status: "UNPROVEN", reason: "blob in git does not hash to casesSha256", lock: lock };
  return { status: "LOCKED", lock: lock };
}

function requireLockable(testPath, options) {
  if (!isGitRepo()) throw new Error("not a git repository: " + process.cwd());
  const rel = gitRelPath(testPath);
  const status = String(git(["status", "--porcelain", "--", rel])).trim();
  if (status !== "") throw new Error(rel + " has uncommitted changes; commit the test first (two-commit rule A then B)");
  const head = headRevision();
  const headHash = blobHash(head, rel);
  if (headHash === null) throw new Error(rel + " is not committed in HEAD; commit the test first");
  const fileHash = sha256Hex(readFileSync(testPath));
  if (headHash !== fileHash) throw new Error(rel + " differs from HEAD; commit it before locking");
  return { rel: rel, head: head, hash: fileHash };
}

export function lock(testPath, options) {
  const info = requireLockable(testPath, options);
  const lockPath = lockPathFor(testPath);
  if (existsSync(lockPath)) throw new Error(lockPath + " already exists; use relock with a reason");
  const sidecar = {
    schemaVersion: LOCK_SCHEMA_VERSION,
    casesSha256: info.hash,
    gitRevision: info.head,
    gitRel: info.rel,
    by: options.by,
    at: new Date().toISOString(),
    relocks: []
  };
  writeFileSync(lockPath, JSON.stringify(sidecar, null, 2) + "\n");
  return { lockPath: lockPath, sidecar: sidecar };
}

export function relock(testPath, options) {
  if (!options.reason || String(options.reason).trim() === "") throw new Error("relock requires --reason \"<why>\"");
  const info = requireLockable(testPath, options);
  const lockPath = lockPathFor(testPath);
  let previous = { relocks: [], casesSha256: null, gitRevision: null };
  if (existsSync(lockPath)) {
    try { previous = JSON.parse(readFileSync(lockPath, "utf8")); } catch (error) { previous = { relocks: [], casesSha256: null, gitRevision: null }; }
  }
  const relocks = Array.isArray(previous.relocks) ? previous.relocks.slice() : [];
  relocks.push({
    by: options.by,
    at: new Date().toISOString(),
    reason: options.reason,
    previousSha256: previous.casesSha256 || null,
    previousGitRevision: previous.gitRevision || null
  });
  const sidecar = {
    schemaVersion: LOCK_SCHEMA_VERSION,
    casesSha256: info.hash,
    gitRevision: info.head,
    gitRel: info.rel,
    by: options.by,
    at: new Date().toISOString(),
    relocks: relocks
  };
  writeFileSync(lockPath, JSON.stringify(sidecar, null, 2) + "\n");
  return { lockPath: lockPath, sidecar: sidecar };
}

// CLI
function parseArgs(argv) {
  const args = { command: null, files: [], by: "orchestrator", reason: null, requireGit: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--by") { args.by = argv[i + 1]; i += 1; }
    else if (token === "--reason") { args.reason = argv[i + 1]; i += 1; }
    else if (token === "--require-git") args.requireGit = true;
    else if (token === "--help" || token === "-h") {
      console.log("usage: node scripts/test-lock.mjs <lock|check|show|relock> <test...> --by <author> [--reason \"<why>\"] [--require-git]");
      process.exit(0);
    } else if (!args.command) args.command = token;
    else args.files.push(token);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.files.length === 0) { console.error("usage: node scripts/test-lock.mjs <lock|check|show|relock> <test...> --by <author> [--reason ...]"); process.exit(2); }
  let exitCode = 0;
  if (args.command === "lock" || args.command === "relock") {
    for (const file of args.files) {
      try {
        const result = args.command === "lock" ? lock(file, args) : relock(file, args);
        console.log("  " + (args.command === "lock" ? "LOCKED " : "RELOCKED ") + file + " -> " + result.lockPath);
      } catch (error) {
        console.error("  FAIL    " + file + ": " + error.message);
        exitCode = 1;
      }
    }
  } else {
    for (const file of args.files) {
      const result = checkLock(file);
      if (args.command === "show") console.log(file + ": " + result.status + (result.lock ? "\n" + JSON.stringify(result.lock, null, 2) : "") + (result.reason ? "\n  reason: " + result.reason : ""));
      else console.log("  " + result.status.padEnd(9) + " " + file + (result.reason ? " (" + result.reason + ")" : ""));
      if (result.status !== "LOCKED") exitCode = 1;
    }
  }
  process.exitCode = exitCode;
}

if (process.argv[1] && process.argv[1].endsWith("test-lock.mjs")) main();