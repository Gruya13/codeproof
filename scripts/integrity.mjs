#!/usr/bin/env node
// Integrity gate for v0.2.0 (F0.4).
//
// Frozen inputs and the historical evidence must never change. This gate checks, mechanically:
//   1. the baseline commit exists and every frozen path still has its baseline tree hash;
//   2. the two frozen benchmark expectations still have their baseline file hashes;
//   3. there is no diff against the baseline and no uncommitted change on any frozen path;
//   4. the working tree of tests/ is clean before `make test`;
//   5. every tests/*.test.mjs has a valid test-lock sidecar (LOCKED).
// Exit 0 only if every check passes. A failure names the path and the expected/actual value.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkLock } from "./test-lock.mjs";

export const BASELINE_COMMIT = "2040aa9e211b785ed89569579cd1bc1f555c4351";

export const FROZEN_TREES = {
  "reports/golden": "5f7d39145315af98fc325cfb1851d2067159f4ad",
  bench: "1de432c5afbae6710d05910e24669f61f8a21195",
  fixtures: "ed1dc62eac9656982d6e2eac227e4433d58c4eb3",
  "reports/probes": "9e4d54b4b45bffbe0fdcc0197f1e9b6b7f6b8a95",
  "reports/real-world": "a6c4704f570fafdc089ee474fd7562cd338c5b7a",
  "reports/historical": "b1837c378520850dff44ab6d4352add1d801c6c3"
};

export const FROZEN_FILES = {
  "bench/expected.json": "de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45",
  "bench/extended/expected.json": "facfe28530448af14518e76ce7161a872970770cbd36a6029273c51f53bf29c7"
};

function git(args, options) {
  return execFileSync("git", args, { encoding: "utf8", stdio: options && options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"] }).trim();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function porcelain(paths) {
  return git(["status", "--porcelain", "--"].concat(paths));
}

function main() {
  const failures = [];
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: ok, detail: detail || null });
    if (!ok) failures.push((detail ? detail : name));
  }

  try { git(["rev-parse", "--verify", BASELINE_COMMIT + "^{commit}"]); }
  catch (error) {
    console.error("FAIL baseline commit " + BASELINE_COMMIT + " is not in this repository (fetch with full history)");
    process.exit(1);
  }

  for (const [path, expected] of Object.entries(FROZEN_TREES)) {
    let actual = null;
    try { actual = git(["rev-parse", "HEAD:" + path]); } catch (error) { actual = "(missing)"; }
    check("tree " + path, actual === expected, "tree " + path + ": expected " + expected + ", got " + actual);
    let diffClean = true;
    try { git(["diff", "--quiet", BASELINE_COMMIT, "--", path]); } catch (error) { diffClean = false; }
    check("no diff vs baseline " + path, diffClean, "frozen path changed since baseline: " + path);
    const status = porcelain([path]);
    check("clean status " + path, status === "", "uncommitted change under frozen path " + path + ":\n" + status);
  }

  for (const [path, expected] of Object.entries(FROZEN_FILES)) {
    let actual = null;
    try { actual = sha256File(path); } catch (error) { actual = "(missing)"; }
    check("sha256 " + path, actual === expected, "sha256 " + path + ": expected " + expected + ", got " + actual);
  }

  const testsStatus = porcelain(["tests"]);
  check("tests/ working tree clean", testsStatus === "", "uncommitted change under tests/ (commit before running make test):\n" + testsStatus);

  const testFiles = readdirSync("tests").filter(function (name) { return name.endsWith(".test.mjs"); }).sort();
  const unlocked = [];
  for (const name of testFiles) {
    const result = checkLock(join("tests", name));
    if (result.status !== "LOCKED") unlocked.push(join("tests", name) + " -> " + result.status + (result.reason ? " (" + result.reason + ")" : ""));
  }
  check("test locks", unlocked.length === 0, "tests without a valid lock (run node scripts/test-lock.mjs lock <test> --by <author> --require-git):\n  " + unlocked.join("\n  "));

  for (const entry of checks) {
    console.log((entry.ok ? "  PASS  " : "  FAIL  ") + entry.name + (entry.ok ? "" : "\n        " + String(entry.detail).replace(/\n/g, "\n        ")));
  }
  if (failures.length > 0) {
    console.error("");
    console.error("INTEGRITY FAIL: " + failures.length + " check(s) failed");
    process.exit(1);
  }
  console.log("");
  console.log("INTEGRITY PASS: " + checks.length + " checks (baseline " + BASELINE_COMMIT.slice(0, 7) + ")");
}

main();