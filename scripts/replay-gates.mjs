#!/usr/bin/env node
// Replay the deterministic gates (L0 + L1) over already saved evidence.
// No model is called and no network is used; the check runs against the commit
// recorded in run.json.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ingest } from "../src/ingest/index.mjs";
import { checkCitation } from "../src/verify/index.mjs";
import { validateFindingsL0 } from "../src/scan/index.mjs";

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(function (key) { return JSON.stringify(key) + ":" + stableJson(value[key]); }).join(",") + "}";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const options = { run: "reports/golden", repo: null, out: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--run") options.run = take();
    else if (arg === "--repo") options.repo = take();
    else if (arg === "--out") options.out = take();
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: node scripts/replay-gates.mjs [--run reports/golden] [--repo <scope>] [--out <file>] [--json]");
      process.exit(0);
    } else throw new Error("unknown option: " + arg);
  }
  return options;
}

function displayPath(target) {
  const rel = relative(process.cwd(), target);
  return rel === "" ? "." : rel;
}

// The run artifact stores the absolute checkout path of the machine that produced
// it. In a fresh clone (possibly another machine/container) that path does not
// exist, so fall back to the longest existing suffix of that path that stays
// inside the current repository.
// In a shallow clone the analyzed commit may be missing. Fetch just that commit
// from origin when possible, so replay still checks the commit instead of the
// working tree; if that is impossible, fail without writing an artifact.
function ensureCommit(repoPath, commit) {
  if (!commit) return true;
  const check = spawnSync("git", ["-C", repoPath, "cat-file", "-e", commit + "^{commit}"], { encoding: "utf8" });
  if (check.status === 0) return true;
  const fetch = spawnSync("git", ["-C", repoPath, "fetch", "--quiet", "--depth", "1", "origin", commit], { encoding: "utf8", timeout: 120000 });
  if (fetch.status === 0) return true;
  console.error("ERROR: analyzed commit " + commit + " is not available in this checkout and could not be fetched from origin.");
  console.error("       Use a full clone, or run: git fetch origin " + commit);
  return false;
}

function resolveScope(options, run) {
  if (options.repo !== null) return resolve(options.repo);
  const stored = run.repo && run.repo.path ? String(run.repo.path) : null;
  if (!stored) return null;
  const candidates = [resolve(stored)];
  const segments = stored.split(/[\\/]+/).filter(Boolean);
  for (let size = segments.length - 1; size >= 1; size -= 1) {
    candidates.push(resolve(segments.slice(-size).join("/")));
  }
  return candidates.find(function (candidate) {
    const rel = relative(process.cwd(), candidate);
    return rel !== "" && !rel.startsWith("..") && !rel.startsWith("/") && existsSync(candidate);
  }) || null;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runDir = resolve(options.run);
  const runPath = join(runDir, "run.json");
  const findingsPath = join(runDir, "findings.json");
  if (!existsSync(runPath)) throw new Error("run.json not found in " + runDir);
  if (!existsSync(findingsPath)) throw new Error("findings.json not found in " + runDir);
  const run = JSON.parse(readFileSync(runPath, "utf8"));
  const published = JSON.parse(readFileSync(findingsPath, "utf8"));
  const repoPath = resolveScope(options, run);
  if (!repoPath) {
    throw new Error("analyzed scope is not available (relative path not found in this clone; use --repo <path>)");
  }
  if (!ensureCommit(repoPath, run.repo && run.repo.commit ? run.repo.commit : null)) {
    process.exit(1);
  }
  const repo = ingest(repoPath);
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const commit = run.repo && run.repo.commit ? run.repo.commit : null;
  const gateRepo = { root: repoPath, manifest: manifest, commit: commit };
  const results = [];
  let mismatches = 0;
  for (const item of published) {
    const finding = item.finding;
    const l0 = validateFindingsL0({ findings: [finding] });
    const checks = (finding.evidence || []).map(function (evidence) { return checkCitation(evidence, gateRepo); });
    const l1Passed = checks.length > 0 && checks.every(function (check) { return check.passed; });
    const stored = item.l1 || {};
    const tolerance = checks.filter(function (check) { return check.passed; })[0];
    const storedTolerance = stored.lineTolerance === undefined ? 0 : stored.lineTolerance;
    const replayTolerance = tolerance && tolerance.lineTolerance !== undefined ? tolerance.lineTolerance : 0;
    const match = l0.ok === true && l1Passed === (stored.passed === true) && replayTolerance === storedTolerance;
    if (!match) mismatches += 1;
    results.push({
      id: finding.id,
      l0: { ok: l0.ok, errors: l0.errors },
      l1: {
        passed: l1Passed,
        storedPassed: stored.passed === true,
        lineTolerance: replayTolerance,
        storedLineTolerance: storedTolerance,
        reason: checks.map(function (check) { return check.reason; }).join(" | ")
      },
      match: match
    });
  }
  const payload = {
    tool: "replay-gates",
    createdAt: run.timings && run.timings.startedAt ? run.timings.startedAt : "unknown",
    runDir: displayPath(runDir),
    runId: run.runId,
    mode: run.mode,
    commit: commit,
    scope: displayPath(repoPath),
    candidateCount: published.length,
    matched: published.length - mismatches,
    mismatches: mismatches,
    passed: mismatches === 0 && published.length > 0,
    results: results
  };
  payload.outputSha256 = sha256(stableJson({ results: results, candidateCount: published.length, commit: commit }));
  const outPath = options.out ? resolve(options.out) : resolve("reports/probes/replay", (run.runId || "run") + "-replay.json");
  mkdirSync(resolve("reports/probes/replay"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log("Replay gates (no model calls)");
    console.log("  run      " + displayPath(runDir) + " (id " + run.runId + ", mode " + run.mode + ")");
    console.log("  commit   " + commit + "  scope " + displayPath(repoPath));
    console.log("  items    " + published.length + " published findings");
    console.log("  result   " + payload.matched + "/" + published.length + " identical, " + mismatches + " mismatch");
    for (const item of results) {
      console.log("    " + item.id + "  L0 " + (item.l0.ok ? "ok" : "FAIL") + "  L1 " + (item.l1.passed ? "pass" : "FAIL") +
        "  tolerance " + item.l1.lineTolerance + " (stored " + item.l1.storedLineTolerance + ")  " + (item.match ? "match" : "MISMATCH"));
    }
    console.log("  sha256   " + payload.outputSha256);
    console.log("  written  " + outPath);
  }
  process.exitCode = payload.passed ? 0 : 1;
}

main();
