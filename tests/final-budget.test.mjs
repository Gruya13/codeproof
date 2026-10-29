import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  audit, check, parseLedger, reserve, settle, spentEffective,
  validateAblationCost, validateNumbering, validateRunCost
} from "../scripts/final-budget.mjs";

const script = resolve("scripts/final-budget.mjs");

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-final-budget-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function row(attemptNo, status = "reserved", reservedUsd = 2, costUsd = null) {
  return { attemptNo, status, reservedUsd, costUsd, runDir: null };
}

function artifact(root, name, report) {
  const dir = join(root, name);
  mkdirSync(dir);
  if (report !== undefined) writeFileSync(join(dir, name.startsWith("ablation") ? "ablation.json" : "run.json"), JSON.stringify(report));
  return dir;
}

function cli(cwd, args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
    return { status: 0, stdout, stderr: "", errorCode: null };
  } catch (error) {
    return { status: error.status, stdout: String(error.stdout), stderr: String(error.stderr), errorCode: error.code };
  }
}

const costCases = [
  { name: "run zero measured cost", kind: "run", report: { usage: { costUsd: 0, measured: true } }, cost: 0 },
  { name: "run fractional measured cost", kind: "run", report: { usage: { costUsd: 0.6204025, measured: true } }, cost: 0.6204025 },
  { name: "run null and unmeasured cost", kind: "run", report: { usage: { costUsd: null, measured: false } } },
  { name: "run string cost", kind: "run", report: { usage: { costUsd: "0.5", measured: true } } },
  { name: "run negative cost", kind: "run", report: { usage: { costUsd: -1, measured: true } } },
  { name: "run NaN cost", kind: "run", report: { usage: { costUsd: NaN, measured: true } }, validatorOnly: true },
  { name: "run Infinity cost", kind: "run", report: { usage: { costUsd: Infinity, measured: true } }, validatorOnly: true },
  { name: "run missing measured flag", kind: "run", report: { usage: { costUsd: 0.5 } } },
  { name: "ablation root cost", kind: "ablation", report: { costUsd: 0.277859 }, cost: 0.277859 },
  { name: "ablation missing cost", kind: "ablation", report: {} },
  { name: "ablation nonnumeric cost", kind: "ablation", report: { costUsd: "0.5" } }
];

for (const item of costCases) {
  test("final budget: " + item.name, function (t) {
    const validation = item.kind === "run" ? validateRunCost(item.report) : validateAblationCost(item.report);
    const valid = Object.hasOwn(item, "cost");
    assert.equal(validation.valid, valid);
    assert.equal(validation.costUsd, valid ? item.cost : null);
    if (item.validatorOnly) return;

    const root = tempDir(t);
    const entries = [row(1)];
    const dir = artifact(root, item.kind === "run" ? "run" : "ablation", item.report);
    const settled = settle(entries, { attempt: 1, artifact: dir });
    assert.equal(settled.status, valid ? "ok" : "unknown-cost");
    assert.equal(settled.costUsd, valid ? item.cost : null);
    assert.equal(settled.runDir, dir);
    assert.equal(spentEffective(entries), valid ? item.cost : 2);
    if (!valid) assert.ok(settled.note, "unknown cost must have a reason");
  });
}

test("final budget: malformed manifest line is rejected", function () {
  assert.deepEqual(parseLedger('{"attemptNo":1}\n\n{"attemptNo":2}\n').map(function (entry) { return entry.attemptNo; }), [1, 2]);
  assert.throws(function () { parseLedger('{"attemptNo":1}\nnot-json\n'); }, /manifest line 2 is not valid JSON/);
});

test("final budget: numbering rejects gaps and duplicate attempts", function () {
  assert.deepEqual(validateNumbering([row(1), row(2)]).problems, []);
  assert.match(validateNumbering([row(1), row(3)]).problems.join("; "), /gap at attemptNo 2/);
  assert.match(validateNumbering([row(1), row(1)]).problems.join("; "), /duplicate attemptNo 1/);
});

test("final budget: effective spend keeps unknown and open reservations", function () {
  const entries = [row(1, "ok", 2, 0.5), row(2, "failed", 3, 1.25), row(3, "unknown-cost", 4), row(4, "reserved", 5), row(5, "ok", 1, 2)];
  assert.equal(spentEffective(entries), 12.75, "a measured cost above the reservation is counted in full");
  assert.equal(spentEffective([row(1, "failed", 7)]), 7, "invalid settled cost cannot release reservation");
});

test("final budget: reserve requires the next unused attempt and no open reservation", function () {
  const entries = [];
  const options = { attempt: 1, block: "b1", label: "run", max: 2 };
  assert.equal(reserve(entries, options).attemptNo, 1);
  assert.throws(function () { reserve(entries, { ...options, attempt: 2 }); }, /hanging reservation/);
  entries[0].status = "ok";
  entries[0].costUsd = 1;
  assert.throws(function () { reserve(entries, options); }, /next gap-free number/);
  assert.throws(function () { reserve(entries, { ...options, attempt: 3 }); }, /next gap-free number/);
  assert.equal(reserve(entries, { ...options, attempt: 2 }).attemptNo, 2);
});

test("final budget: reserve enforces absolute cap and validates fields", function () {
  const entries = [row(1, "ok", 40, 39.9)];
  const options = { attempt: 2, block: "b", label: "l", max: 1 };
  assert.throws(function () { reserve(entries, options); }, /exceed the hard cap/);
  assert.throws(function () { reserve([], { ...options, attempt: 1, cap: 40.01 }); }, /cannot exceed the hard cap/);
  assert.throws(function () { reserve([], { ...options, attempt: 1, block: "  " }); }, /--block is required/);
  assert.throws(function () { reserve([], { ...options, attempt: 1, label: "  " }); }, /--label is required/);
  for (const max of [0, -1, "bad", Infinity]) {
    assert.throws(function () { reserve([], { ...options, attempt: 1, max }); }, /--max/);
  }
});

test("final budget: settle uses exit code and ablation root cost", function (t) {
  const root = tempDir(t);
  const runDir = artifact(root, "run", { usage: { measured: true, costUsd: 0.5 } });
  const ablationDir = artifact(root, "ablation", { costUsd: 0.277859 });
  const failed = [row(1)];
  assert.equal(settle(failed, { attempt: 1, artifact: runDir, exitCode: 1 }).status, "failed");
  assert.equal(failed[0].costUsd, 0.5);
  const successful = [row(1)];
  assert.equal(settle(successful, { attempt: 1, artifact: runDir, exitCode: 0 }).status, "ok");
  const ablation = [row(1)];
  assert.equal(settle(ablation, { attempt: 1, artifact: ablationDir }).status, "ok");
  assert.equal(ablation[0].costUsd, 0.277859);
  assert.equal(ablation[0].runDir, ablationDir);
});

test("final budget: manual cost is validated and missing report keeps reservation", function (t) {
  const root = tempDir(t);
  const emptyDir = artifact(root, "empty");
  const entries = [row(1)];
  const unknown = settle(entries, { attempt: 1, artifact: emptyDir });
  assert.equal(unknown.status, "unknown-cost");
  assert.equal(unknown.costUsd, null);
  assert.match(unknown.note, /no run.json or ablation.json/);
  assert.equal(spentEffective(entries), 2);

  for (const manualCost of ["bad", "-1", "Infinity", "NaN"]) {
    const fresh = [row(1)];
    assert.throws(function () { settle(fresh, { attempt: 1, manualCost }); }, /--manual-cost/);
    assert.equal(fresh[0].status, "reserved");
    assert.equal(spentEffective(fresh), 2);
  }
  const manual = [row(1)];
  assert.equal(settle(manual, { attempt: 1, manualCost: "0", exitCode: 0 }).status, "ok");
  assert.equal(manual[0].costUsd, 0);
  assert.match(manual[0].note, /API log/);
});

test("final budget: check rejects hanging reservations and cap overflow", function () {
  assert.deepEqual(check([], { nextMax: 1 }), { spent: 0, nextMax: 1, cap: 40 });
  assert.throws(function () { check([row(1)], {}); }, /hanging reservation/);
  assert.throws(function () { check([row(1, "ok", 40, 39.9)], { nextMax: 1 }); }, /does not fit/);
});

test("final budget: audit rejects unlisted artifacts and numbering gaps outside git", function (t) {
  const root = tempDir(t);
  const reports = join(root, "reports");
  mkdirSync(reports);
  artifact(reports, "run", { usage: { costUsd: 0, measured: true } });
  const previous = process.cwd();
  try {
    process.chdir(root);
    const unlisted = audit([], { dir: reports });
    assert.equal(unlisted.ok, false);
    assert.match(unlisted.problems.join("; "), /artifact not in the manifest/);
    const gap = audit([row(1, "unknown-cost"), row(3, "unknown-cost")], { dir: reports });
    assert.equal(gap.ok, false);
    assert.match(gap.problems.join("; "), /gap at attemptNo 2/);
  } finally {
    process.chdir(previous);
  }
});

test("final budget CLI: check and audit return 0 or 1", function (t) {
  const root = tempDir(t);
  const ledger = join(root, "ATTEMPTS.jsonl");
  const reports = join(root, "reports");
  mkdirSync(reports);
  try {
    const probe = execFileSync(process.execPath, ["-e", "process.stdout.write('child-ok')"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
    if (probe !== "child-ok") {
      t.skip("sandbox does not run child Node processes");
      return;
    }
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    t.skip("sandbox blocks child Node processes");
    return;
  }
  const empty = cli(root, ["check", "--ledger", ledger]);
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /CHECK OK/);
  const missing = cli(root, ["check", "--ledger", ledger, "--next-max", "41"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /next run does not fit/);

  artifact(reports, "run", { usage: { costUsd: 0, measured: true } });
  const unlisted = cli(root, ["audit", "--ledger", ledger, "--dir", reports]);
  assert.equal(unlisted.status, 1);
  assert.match(unlisted.stderr, /artifact not in the manifest/);
  writeFileSync(ledger, JSON.stringify(row(1, "unknown-cost")) + "\n" + JSON.stringify(row(3, "unknown-cost")) + "\n");
  const gap = cli(root, ["audit", "--ledger", ledger, "--dir", reports]);
  assert.equal(gap.status, 1);
  assert.match(gap.stderr, /gap at attemptNo 2/);
});
