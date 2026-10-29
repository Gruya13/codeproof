#!/usr/bin/env node
// Final-round budget ledger and attempt manifest (PREREG-AMENDMENT-1..4).
//
// The round's hard cap is enforced by two mechanics:
//   1. reserve/settle around every paid run: a reservation is recorded (and git-anchored) BEFORE
//      the money is spent; settle then replaces it with the measured cost of that attempt;
//   2. a reservation whose cost is unknowable (run crashed, cost not measured, invalid value)
//      stays in spentEffective forever as the reserved worst case - the ledger never under-counts.
//
// Valid cost (A4): run.json.usage.measured === true AND a finite non-negative number in
// usage.costUsd; the held-out ablation uses ablation.json.costUsd at the root (the hardBudget
// fix in scripts/ablation.mjs is the proven upper bound). Everything else is "unknown-cost".
//
// Commands (all paths relative to the repository root):
//   reserve --attempt <n> --block <b> --label <l> --max <usd>   record a reservation
//   check [--next-max <usd>]                                    spentEffective + next <= cap?
//   settle --attempt <n> [--artifact <dir>] [--exit-code <n>] [--manual-cost <usd>]
//   audit                                                        manifest vs artifacts vs git
//
// The manifest is reports/final/ATTEMPTS.jsonl, one JSON object per line; attemptNo is a gap-free
// 1..N sequence and is never reused. Removing a row invalidates the audit (the git history of the
// file is the anchor: final-run.sh commits the reservation before the run and the settle after).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export const HARD_CAP_USD = 40;
export const TARGET_USD = 35;
export const DEFAULT_LEDGER = "reports/final/ATTEMPTS.jsonl";
export const OPEN_STATUSES = new Set(["reserved", "started", "aborted"]);
export const SETTLED_STATUSES = new Set(["ok", "failed"]);

function fail(message) {
  const error = new Error(message);
  error.code = "LEDGER_ERROR";
  throw error;
}

function assertFiniteNumber(name, value) {
  const number = Number(value);
  if (typeof value === "boolean" || String(value).trim() === "" || !Number.isFinite(number)) {
    fail(name + " must be a finite number, got " + JSON.stringify(String(value)));
  }
  return number;
}

// A4 §1: a cost is valid only when it is measured AND a finite non-negative number. A null,
// string, negative, NaN, Infinity, missing measured flag or measured:false is never accepted.
export function validateRunCost(run) {
  const usage = run && typeof run === "object" ? run.usage : null;
  if (!usage || typeof usage !== "object") return { valid: false, costUsd: null, reason: "missing usage" };
  if (usage.measured !== true) {
    return { valid: false, costUsd: null, reason: usage.measured === false ? "not measured" : "measured flag missing" };
  }
  return validateCostValue(usage.costUsd, "usage.costUsd");
}

export function validateAblationCost(ablation) {
  if (!ablation || typeof ablation !== "object") return { valid: false, costUsd: null, reason: "missing ablation report" };
  return validateCostValue(ablation.costUsd, "costUsd");
}

function validateCostValue(cost, name) {
  if (typeof cost !== "number") {
    return { valid: false, costUsd: null, reason: "invalid " + name + ": " + (cost === null ? "null" : typeof cost) };
  }
  if (!Number.isFinite(cost)) return { valid: false, costUsd: null, reason: "invalid " + name + ": " + String(cost) };
  if (cost < 0) return { valid: false, costUsd: null, reason: "invalid " + name + ": negative" };
  return { valid: true, costUsd: cost, reason: null };
}

// One object per line; a malformed line is a hard failure, never silently skipped.
export function parseLedger(text) {
  const entries = [];
  const lines = String(text).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "") continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      fail("manifest line " + (index + 1) + " is not valid JSON: " + error.message);
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail("manifest line " + (index + 1) + " is not an object");
    entries.push(entry);
  }
  return entries;
}

// A1 §8 / A2 §4: gap-free 1..N numbering, no duplicates; a gap means a row was deleted.
export function validateNumbering(entries) {
  const problems = [];
  const seen = new Set();
  let max = 0;
  for (const entry of entries) {
    const number = entry.attemptNo;
    if (!Number.isInteger(number) || number < 1) {
      problems.push("invalid attemptNo " + JSON.stringify(number));
      continue;
    }
    if (seen.has(number)) problems.push("duplicate attemptNo " + number);
    seen.add(number);
    if (number > max) max = number;
  }
  for (let number = 1; number <= max; number += 1) {
    if (!seen.has(number)) problems.push("gap at attemptNo " + number);
  }
  return { ok: problems.length === 0, problems: problems, max: max, count: entries.length };
}

export function openReservations(entries) {
  return entries.filter(function (entry) { return OPEN_STATUSES.has(entry.status); });
}

// A2 §3 / A4 §2: settled rows contribute their measured cost; every open or unknown-cost row
// contributes its reservation, so spentEffective never under-estimates the money already spent.
export function spentEffective(entries) {
  let total = 0;
  for (const entry of entries) {
    if (SETTLED_STATUSES.has(entry.status)) {
      if (typeof entry.costUsd === "number" && Number.isFinite(entry.costUsd) && entry.costUsd >= 0) {
        total += entry.costUsd;
      } else {
        total += Number(entry.reservedUsd) || 0;
      }
    } else {
      total += Number(entry.reservedUsd) || 0;
    }
  }
  return total;
}

export function nextAttemptNo(entries) {
  let max = 0;
  for (const entry of entries) {
    if (Number.isInteger(entry.attemptNo) && entry.attemptNo > max) max = entry.attemptNo;
  }
  return max + 1;
}

function ledgerPath(options) {
  const fromOptions = options && options.ledger;
  const fromEnv = process.env.FINAL_LEDGER;
  return resolve(fromOptions || fromEnv || DEFAULT_LEDGER);
}

function loadLedger(path) {
  if (!existsSync(path)) return [];
  return parseLedger(readFileSync(path, "utf8"));
}

function saveLedger(path, entries) {
  mkdirSync(dirname(path), { recursive: true });
  const body = entries.map(function (entry) { return JSON.stringify(entry); }).join("\n");
  writeFileSync(path, body === "" ? "" : body + "\n");
  return path;
}

function git(args, options) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: (options && options.cwd) || process.cwd() }).trim();
}

function isGitRepo() {
  try { git(["rev-parse", "--git-dir"]); return true; } catch (error) { return false; }
}

function assertNumbering(entries) {
  const numbering = validateNumbering(entries);
  if (!numbering.ok) fail("manifest numbering is invalid (a row was deleted or reused):\n  " + numbering.problems.join("\n  "));
  return numbering;
}

function formatUsd(value) {
  return "$" + value.toFixed(4);
}

function statusLine(entries) {
  const spent = spentEffective(entries);
  const open = openReservations(entries);
  const openTotal = open.reduce(function (sum, entry) { return sum + (Number(entry.reservedUsd) || 0); }, 0);
  const settledTotal = entries.reduce(function (sum, entry) {
    return SETTLED_STATUSES.has(entry.status) && typeof entry.costUsd === "number" ? sum + entry.costUsd : sum;
  }, 0);
  const remaining = HARD_CAP_USD - spent;
  return "attempts " + entries.length + " | settled " + formatUsd(settledTotal) +
    " | open/reserved " + open.length + " (" + formatUsd(openTotal) + ")" +
    " | spentEffective " + formatUsd(spent) + " of " + formatUsd(HARD_CAP_USD) +
    " | remaining " + formatUsd(Math.max(0, remaining));
}

function warnIfTargetReached(entries) {
  if (spentEffective(entries) >= TARGET_USD) {
    console.log("WARNING: spentEffective reached the $" + TARGET_USD + " target - the round stops unless this is a reserve re-run (recorded in an amendment).");
  }
}

export function reserve(entries, options) {
  assertNumbering(entries);
  const open = openReservations(entries);
  if (open.length > 0) {
    fail("hanging reservation(s) must be settled first (A3 §4): " + open.map(function (entry) { return "attempt " + entry.attemptNo + " (" + entry.status + ")"; }).join(", "));
  }
  const block = String(options.block || "").trim();
  const label = String(options.label || "").trim();
  if (block === "") fail("--block is required");
  if (label === "") fail("--label is required");
  const max = assertFiniteNumber("--max", options.max);
  if (max <= 0) fail("--max must be positive");
  const expected = nextAttemptNo(entries);
  const requested = options.attempt === undefined ? expected : assertFiniteNumber("--attempt", options.attempt);
  if (!Number.isInteger(requested) || requested < 1) fail("--attempt must be a positive integer");
  if (requested !== expected) fail("--attempt " + requested + " is not the next gap-free number (" + expected + ")");
  const cap = options.cap === undefined ? HARD_CAP_USD : assertFiniteNumber("--cap", options.cap);
  // The $40 hard cap is absolute (PREREG A1 §2): --cap can only be tightened, never raised.
  if (cap > HARD_CAP_USD + 1e-9) fail("--cap cannot exceed the hard cap of " + formatUsd(HARD_CAP_USD));
  const spent = spentEffective(entries);
  if (spent + max > cap + 1e-9) {
    fail("reservation of " + formatUsd(max) + " would exceed the hard cap: spentEffective " + formatUsd(spent) + " + " + formatUsd(max) + " > " + formatUsd(cap));
  }
  const entry = {
    attemptNo: requested,
    block: block,
    label: label,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "reserved",
    reservedUsd: max,
    costUsd: null,
    runDir: null,
    note: null
  };
  entries.push(entry);
  return entry;
}

function artifactKind(dir) {
  if (existsSync(join(dir, "run.json"))) return "run";
  if (existsSync(join(dir, "ablation.json"))) return "ablation";
  return null;
}

function relativeDir(dir) {
  const rel = relative(process.cwd(), dir);
  if (rel === "") return ".";
  // Paths outside the working tree (e.g. a dry-run artifact in /tmp) stay absolute: a relative
  // "../../tmp/..." path would be ambiguous to a verifier reading the manifest from another cwd.
  if (rel.startsWith("..") || isAbsolute(rel)) return dir;
  return rel;
}

export function settle(entries, options) {
  assertNumbering(entries);
  const attempt = assertFiniteNumber("--attempt", options.attempt);
  const entry = entries.find(function (candidate) { return candidate.attemptNo === attempt; });
  if (!entry) fail("attempt " + attempt + " is not in the manifest");
  if (!OPEN_STATUSES.has(entry.status)) fail("attempt " + attempt + " is already settled (" + entry.status + ")");

  const result = {
    endedAt: new Date().toISOString(),
    costUsd: null,
    runDir: null,
    note: null,
    status: "unknown-cost"
  };

  if (options.artifact !== undefined && String(options.artifact).trim() !== "") {
    const artifact = resolve(String(options.artifact));
    result.runDir = relativeDir(artifact);
    const kind = existsSync(artifact) ? artifactKind(artifact) : null;
    if (kind === null) {
      result.note = existsSync(artifact) ? "artifact directory has no run.json or ablation.json" : "artifact directory does not exist";
    } else if (kind === "run") {
      const run = JSON.parse(readFileSync(join(artifact, "run.json"), "utf8"));
      const validation = validateRunCost(run);
      if (validation.valid) {
        result.costUsd = validation.costUsd;
        result.status = settleStatus(options, run);
      } else {
        result.note = validation.reason;
      }
    } else {
      const ablation = JSON.parse(readFileSync(join(artifact, "ablation.json"), "utf8"));
      const validation = validateAblationCost(ablation);
      if (validation.valid) {
        result.costUsd = validation.costUsd;
        result.status = settleStatus(options, null);
      } else {
        result.note = validation.reason;
      }
    }
  } else {
    result.note = "run produced no artifact";
  }

  // A4 §2: a manually entered cost must pass the same validation as a measured one.
  if (options.manualCost !== undefined && String(options.manualCost).trim() !== "") {
    const manual = validateCostValue(assertFiniteNumber("--manual-cost", options.manualCost), "--manual-cost");
    if (!manual.valid) fail("--manual-cost is not a valid cost: " + manual.reason);
    result.costUsd = manual.costUsd;
    result.status = settleStatus(options, null);
    result.note = "manual cost from the API log";
  }

  entry.endedAt = result.endedAt;
  entry.status = result.status;
  entry.costUsd = result.costUsd;
  entry.runDir = result.runDir;
  entry.note = result.note;
  return entry;
}

function settleStatus(options, run) {
  const exitCode = options.exitCode === undefined ? null : assertFiniteNumber("--exit-code", options.exitCode);
  if (exitCode !== null) return exitCode === 0 ? "ok" : "failed";
  if (run && run.budget && run.budget.aborted === true) return "failed";
  if (options.failed === true) return "failed";
  return "ok";
}

export function check(entries, options) {
  assertNumbering(entries);
  const open = openReservations(entries);
  if (open.length > 0) {
    fail("hanging reservation(s): " + open.map(function (entry) { return "attempt " + entry.attemptNo + " (" + entry.status + ")"; }).join(", "));
  }
  const cap = options.cap === undefined ? HARD_CAP_USD : assertFiniteNumber("--cap", options.cap);
  const nextMax = options.nextMax === undefined ? 0 : assertFiniteNumber("--next-max", options.nextMax);
  if (nextMax < 0) fail("--next-max must be non-negative");
  const spent = spentEffective(entries);
  if (spent + nextMax > cap + 1e-9) {
    fail("next run does not fit: spentEffective " + formatUsd(spent) + " + next-max " + formatUsd(nextMax) + " > " + formatUsd(cap));
  }
  return { spent: spent, nextMax: nextMax, cap: cap };
}

function walkArtifacts(root) {
  const artifacts = [];
  if (!existsSync(root)) return artifacts;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      // Clones under reports/final/**/_repo are git-ignored inputs, never run artifacts.
      if (entry.name === "_repo") continue;
      stack.push(child);
    }
    const kind = artifactKind(dir);
    if (kind !== null) artifacts.push({ dir: dir, rel: relativeDir(dir), kind: kind });
  }
  return artifacts.sort(function (a, b) { return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0; });
}

export function audit(entries, options) {
  const root = resolve(options.dir || "reports/final");
  const problems = [];
  const numbering = validateNumbering(entries);
  if (!numbering.ok) problems.push("manifest numbering: " + numbering.problems.join("; "));
  const artifacts = walkArtifacts(root);
  const byRunDir = new Map();
  for (const entry of entries) {
    if (entry.runDir) {
      const key = relativeDir(resolve(entry.runDir));
      if (byRunDir.has(key)) problems.push("runDir " + key + " is claimed by two attempts");
      byRunDir.set(key, entry);
    }
  }
  for (const artifact of artifacts) {
    if (!byRunDir.has(artifact.rel)) problems.push("artifact not in the manifest: " + artifact.rel);
  }
  for (const entry of entries) {
    if (SETTLED_STATUSES.has(entry.status)) {
      if (!entry.runDir) problems.push("attempt " + entry.attemptNo + " is settled (" + entry.status + ") without runDir");
      else if (!byRunDir.has(relativeDir(resolve(entry.runDir)))) problems.push("attempt " + entry.attemptNo + " runDir does not exist: " + entry.runDir);
    }
    if (entry.status === "reserved" && entry.costUsd !== null) problems.push("attempt " + entry.attemptNo + " is reserved but carries costUsd");
  }
  if (isGitRepo()) {
    const ledger = ledgerPath(options);
    try {
      const repoRoot = git(["rev-parse", "--show-toplevel"]);
      const insideRepo = function (path) {
        const rel = relative(repoRoot, resolve(path));
        return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
      };
      const ledgerRel = relative(repoRoot, ledger);
      // A ledger outside the repository (dry-run in /tmp) has nothing to anchor in this history.
      if (insideRepo(ledger) && existsSync(ledger)) {
        try {
          git(["-C", repoRoot, "ls-files", "--error-unmatch", ledgerRel]);
        } catch (error) {
          problems.push("manifest is not committed to git: " + ledgerRel);
        }
      }
      if (problems.length === 0) {
        for (const artifact of artifacts) {
          if (!insideRepo(artifact.rel)) continue;
          const tracked = git(["-C", repoRoot, "ls-files", "--", artifact.rel]);
          if (tracked === "") problems.push("artifact is not committed to git: " + artifact.rel);
        }
      }
      if (insideRepo(ledger) && existsSync(ledger)) {
        const dirty = git(["-C", repoRoot, "status", "--porcelain", "--", ledgerRel, "reports/final"]);
        if (dirty !== "") problems.push("reports/final has uncommitted changes (settle then commit):\n" + dirty);
      }
    } catch (error) {
      problems.push("git check failed: " + error.message);
    }
  }
  return { ok: problems.length === 0, problems: problems, artifacts: artifacts, attempts: entries.length, spent: spentEffective(entries) };
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail("unexpected argument: " + token);
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      options[camel(body.slice(0, eq))] = body.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[camel(body)] = true;
      continue;
    }
    options[camel(body)] = next;
    index += 1;
  }
  return options;
}

function camel(name) {
  return name.replace(/-([a-z])/g, function (match, letter) { return letter.toUpperCase(); });
}

export function run(argv) {
  const command = argv[0];
  const options = parseOptions(argv.slice(1));
  const ledger = ledgerPath(options);
  const entries = loadLedger(ledger);
  if (command === "reserve") {
    const entry = reserve(entries, options);
    saveLedger(ledger, entries);
    console.log("RESERVED attempt " + entry.attemptNo + " (" + entry.block + " / " + entry.label + ") max " + formatUsd(entry.reservedUsd));
    console.log("  " + statusLine(entries));
    warnIfTargetReached(entries);
    return 0;
  }
  if (command === "check") {
    const result = check(entries, options);
    console.log("CHECK OK: spentEffective " + formatUsd(result.spent) + " + next-max " + formatUsd(result.nextMax) + " <= " + formatUsd(result.cap));
    console.log("  " + statusLine(entries));
    warnIfTargetReached(entries);
    return 0;
  }
  if (command === "settle") {
    const entry = settle(entries, options);
    saveLedger(ledger, entries);
    console.log("SETTLED attempt " + entry.attemptNo + ": " + entry.status + " cost " + (entry.costUsd === null ? "unknown (reservation kept)" : formatUsd(entry.costUsd)));
    if (entry.runDir) console.log("  runDir " + entry.runDir);
    if (entry.note) console.log("  note   " + entry.note);
    console.log("  " + statusLine(entries));
    return 0;
  }
  if (command === "audit") {
    const result = audit(entries, options);
    if (!result.ok) {
      console.error("AUDIT FAIL (" + result.problems.length + " problem(s)):");
      for (const problem of result.problems) console.error("  - " + problem);
      return 1;
    }
    console.log("AUDIT PASS: " + result.attempts + " attempts, " + result.artifacts.length + " artifacts, spentEffective " + formatUsd(result.spent));
    console.log("  " + statusLine(entries));
    return 0;
  }
  fail("usage: final-budget.mjs reserve|check|settle|audit [options]");
  return 1;
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    console.error("ERROR: " + error.message);
    process.exitCode = 1;
  }
}
