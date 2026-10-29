import test from "node:test";
import assert from "node:assert/strict";
import { mergeScannerRuns, sameFinding } from "../src/scan/merge.mjs";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function tempDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function evidence(path, startLine, endLine) {
  return { path: path, startLine: startLine, endLine: endLine, snippet: "const x = 1;" };
}

function finding(id, entries, claim) {
  return { id: id, category: "correctness", kind: "direct", severity: "high", title: "Finding " + id,
    claim: claim, evidence: entries, confidence: 0.9 };
}

test("E1 claim stemming merges inflected paraphrases of the same defect", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "The page mutates the input array in place.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "Mutating the input array in place corrupts it.");
  assert.equal(sameFinding(left, right), true);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 1);
  assert.deepEqual(merged.candidates[0].proposedBy, ["spark", "wonder"]);
});

test("E1 stemming keeps genuinely different claims on the same line separate", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "The page includes one item beyond the requested end.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "The page mutates the input array in place.");
  assert.equal(sameFinding(left, right), false);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 2);
});

test("E2 dedup compares every evidence entry, not only the first", function () {
  const left = finding("F-001", [evidence("src/a.ts", 40, 42), evidence("src/a.ts", 10, 12)], "Mutates the input array in place.");
  const right = finding("F-002", [evidence("src/a.ts", 11, 13)], "Mutating the input array in place corrupts it.");
  assert.equal(sameFinding(left, right), true);
  const merged = mergeScannerRuns([
    { proposedBy: "spark", findings: [left] },
    { proposedBy: "wonder", findings: [right] }
  ]);
  assert.equal(merged.candidates.length, 1);
  assert.deepEqual(merged.candidates[0].proposedBy, ["spark", "wonder"]);
});

test("E2 the same claim in different files is never merged", function () {
  const left = finding("F-001", [evidence("src/a.ts", 10, 12)], "Mutates the input array in place.");
  const right = finding("F-002", [evidence("src/b.ts", 10, 12)], "Mutates the input array in place.");
  assert.equal(sameFinding(left, right), false);
});

test("E3 a symlinked --out that points into the analyzed repository is refused", function (t) {
  const dir = tempDir(t, "codeproof-e3-");
  const fixture = join(dir, "fixture");
  cpSync(join(repoRoot, "fixtures/mini-repo"), fixture, { recursive: true });
  mkdirSync(join(fixture, "reports"), { recursive: true });
  const linkPath = join(dir, "out-link");
  symlinkSync(join(fixture, "reports"), linkPath, "dir");
  const cliPath = join(repoRoot, "src/cli.mjs");
  const result = spawnSync(process.execPath, [cliPath, "analyze", fixture, "--mock", "--mode", "demo", "--out", linkPath], {
    cwd: repoRoot, timeout: 120000, env: Object.assign({}, process.env, { USE_MOCK: "1" }), encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "a symlinked --out into the analyzed repository must be refused");
  assert.match(result.stdout + result.stderr, /inside the analyzed repository/);
});
