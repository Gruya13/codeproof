#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function overlaps(a, b) {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

export function buildIndex(expected) {
  const index = [];
  for (const problem of expected.problems) index.push({ kind: "problem", id: problem.id, file: problem.file, startLine: problem.startLine, endLine: problem.endLine });
  for (const trap of expected.traps) index.push({ kind: "trap", id: trap.id, file: trap.file, startLine: trap.startLine, endLine: trap.endLine });
  for (const extra of expected.extraTrue) index.push({ kind: "extra", id: extra.id, file: extra.file, startLine: extra.startLine, endLine: extra.endLine });
  return index;
}

export function matchTarget(evidence, index) {
  if (!evidence) return null;
  for (const entry of index) {
    if (entry.file === evidence.path && overlaps(evidence, entry)) return entry;
  }
  return null;
}

export function selectBenchRun(reportsDir) {
  const base = reportsDir || "reports";
  let entries;
  try {
    entries = readdirSync(base, { withFileTypes: true });
  } catch (error) {
    throw new Error("reports directory is not readable: " + base + " (" + error.message + ")");
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "archive") continue;
    const dir = join(base, entry.name);
    const runPath = join(dir, "run.json");
    if (!existsSync(runPath)) continue;
    let run;
    try {
      run = JSON.parse(readFileSync(runPath, "utf8"));
    } catch (error) {
      continue;
    }
    if (run.mode !== "bench") continue;
    const parsed = run.timings && run.timings.startedAt ? Date.parse(run.timings.startedAt) : 0;
    let mtime = 0;
    try { mtime = statSync(runPath).mtimeMs; } catch (error) { mtime = 0; }
    candidates.push({ dir: dir, startedAt: Number.isNaN(parsed) ? 0 : parsed, mtime: mtime });
  }
  if (candidates.length === 0) {
    throw new Error("no benchmark run found in " + base + " (mode: bench); run 'make bench' first");
  }
  candidates.sort(function (a, b) {
    if (b.startedAt !== a.startedAt) return b.startedAt - a.startedAt;
    return b.mtime - a.mtime;
  });
  return candidates[0].dir;
}

export function scoreRun(expected, findings) {
  const index = buildIndex(expected);
  const problemState = new Map();
  for (const problem of expected.problems) problemState.set(problem.id, { verified: false, refuted: false, moderate: false, uncertain: false, duplicates: 0 });
  const trapState = new Map();
  for (const trap of expected.traps) trapState.set(trap.id, { verified: false, refuted: false, moderate: false, uncertain: false });
  const extraSeen = new Set();
  const falsePositives = [];
  let verifiedTp = 0;
  let verifiedFp = 0;
  let duplicateVerified = 0;
  for (const item of findings) {
    const evidence = item && item.finding && Array.isArray(item.finding.evidence) ? item.finding.evidence[0] : null;
    const target = matchTarget(evidence, index);
    if (target === null) {
      if (item.status === "verified") {
        verifiedFp += 1;
        falsePositives.push({ id: item.finding.id, title: item.finding.title, path: evidence ? evidence.path : null, startLine: evidence ? evidence.startLine : null });
      }
      continue;
    }
    if (target.kind === "extra") {
      extraSeen.add(target.id);
      continue;
    }
    if (target.kind === "trap") {
      const state = trapState.get(target.id);
      if (state[item.status] !== undefined) state[item.status] = true;
      if (item.status === "verified") {
        verifiedFp += 1;
        falsePositives.push({ id: item.finding.id, title: item.finding.title, path: evidence ? evidence.path : null, startLine: evidence ? evidence.startLine : null, trap: true });
      }
      continue;
    }
    const state = problemState.get(target.id);
    if (item.status === "verified") {
      if (state.verified) {
        state.duplicates += 1;
        duplicateVerified += 1;
      } else {
        state.verified = true;
        verifiedTp += 1;
      }
    } else if (item.status === "refuted") state.refuted = true;
    else if (item.status === "moderate") state.moderate = true;
    else state.uncertain = true;
  }
  const totalProblems = expected.problems.length;
  const trapsVerified = [...trapState.values()].filter(function (state) { return state.verified; }).length;
  const trapsModerate = [...trapState.values()].filter(function (state) { return state.moderate; }).length;
  const falseRefutations = [...problemState.values()].filter(function (state) { return state.refuted; }).length;
  const precision = verifiedTp + verifiedFp > 0 ? verifiedTp / (verifiedTp + verifiedFp) : null;
  const scoring = expected.scoring || {};
  const metrics = {
    problems: totalProblems,
    trapsTotal: expected.traps.length,
    verifiedTp,
    verifiedFp,
    precision,
    e2eRecall: totalProblems > 0 ? verifiedTp / totalProblems : null,
    trapsVerified,
    trapsModerate,
    falseRefutations,
    duplicateVerified,
    extraTrueSeen: [...extraSeen],
    falsePositives
  };
  metrics.checks = [
    { name: "e2e recall >= " + (scoring.e2eRecallMin || 6) + "/" + totalProblems, pass: verifiedTp >= (scoring.e2eRecallMin || 6) },
    { name: "precision >= " + Math.round((scoring.precisionMin === undefined ? 0.9 : scoring.precisionMin) * 100) + "%", pass: precision === null ? true : precision >= (scoring.precisionMin === undefined ? 0.9 : scoring.precisionMin) },
    { name: "traps verified = " + (scoring.trapsVerifiedMax === undefined ? 0 : scoring.trapsVerifiedMax) + "/" + expected.traps.length, pass: trapsVerified <= (scoring.trapsVerifiedMax === undefined ? 0 : scoring.trapsVerifiedMax) },
    { name: "false refutations <= " + (scoring.falseRefutationsMax === undefined ? 1 : scoring.falseRefutationsMax), pass: falseRefutations <= (scoring.falseRefutationsMax === undefined ? 1 : scoring.falseRefutationsMax) }
  ];
  metrics.pass = metrics.checks.every(function (check) { return check.pass; });
  return metrics;
}

function percent(value) {
  return value === null ? "n/a" : Math.round(value * 1000) / 10 + "%";
}

export function formatReport(metrics, meta) {
  const lines = [];
  lines.push("# Benchmark score");
  lines.push("");
  if (meta) lines.push("Run: " + meta + " | n = " + metrics.problems + " problems (calibration set)");
  lines.push("");
  lines.push("| Metric | Value | Threshold |");
  lines.push("|---|---|---|");
  lines.push("| Verified TP | " + metrics.verifiedTp + " | |");
  lines.push("| Verified FP | " + metrics.verifiedFp + " | |");
  lines.push("| Precision (verified-only) | " + percent(metrics.precision) + " | >= 90% |");
  lines.push("| End-to-end recall | " + metrics.verifiedTp + "/" + metrics.problems + " (" + percent(metrics.e2eRecall) + ") | >= 6/8 |");
  lines.push("| Traps verified | " + metrics.trapsVerified + "/" + metrics.trapsTotal + " | 0/4 |");
  lines.push("| Traps moderate (shown separately) | " + metrics.trapsModerate + " | displayed |");
  lines.push("| False refutations | " + metrics.falseRefutations + " | <= 1 |");
  lines.push("| Duplicate verified findings | " + metrics.duplicateVerified + " | not FP |");
  lines.push("| extraTrue seen (neither TP nor FP) | " + (metrics.extraTrueSeen.join(", ") || "none") + " | |");
  lines.push("");
  if (metrics.falsePositives.length > 0) {
    lines.push("## False positives");
    lines.push("");
    for (const fp of metrics.falsePositives) lines.push("- " + fp.id + " " + fp.title + " (" + fp.path + ":" + fp.startLine + ")" + (fp.trap ? " - leaked trap (negative control)" : ""));
    lines.push("");
  }
  lines.push("## Threshold checks");
  lines.push("");
  for (const check of metrics.checks) lines.push("- [" + (check.pass ? "x" : " ") + "] " + check.name);
  lines.push("");
  lines.push("Computed from the status field in findings.json, never from where a finding is displayed.");
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { expectedPath: "bench/expected.json", findingsPath: null, runDir: null, jsonOut: null, positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") { options.runDir = argv[index + 1]; index += 1; }
    else if (arg === "--expected") { options.expectedPath = argv[index + 1]; index += 1; }
    else if (arg === "--json") { options.jsonOut = argv[index + 1]; index += 1; }
    else if (arg.startsWith("--")) throw new Error("unknown option: " + arg);
    else options.positional.push(arg);
  }
  if (options.positional.length > 0) options.expectedPath = options.positional[0];
  if (options.positional.length > 1) options.findingsPath = options.positional[1];
  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    let findingsPath = options.findingsPath;
    if (options.runDir !== null && options.runDir !== undefined && String(options.runDir).trim() !== "") {
      findingsPath = join(options.runDir, "findings.json");
    }
    if (!findingsPath) {
      const selected = selectBenchRun("reports");
      findingsPath = join(selected, "findings.json");
      console.log("Selected benchmark run: " + selected);
    }
    const expected = JSON.parse(readFileSync(options.expectedPath, "utf8"));
    const findings = JSON.parse(readFileSync(findingsPath, "utf8"));
    const metrics = scoreRun(expected, findings);
    console.log(formatReport(metrics, findingsPath));
    console.log("");
    console.log(JSON.stringify(metrics, null, 2));
    if (options.jsonOut) writeFileSync(options.jsonOut, JSON.stringify(metrics, null, 2) + "\n");
    process.exitCode = metrics.pass ? 0 : 1;
  } catch (error) {
    console.error("ERROR: " + error.message);
    process.exitCode = 1;
  }
}

function invokedDirectly() {
  const entry = process.argv[1] || "";
  return entry.endsWith("score.mjs");
}

if (invokedDirectly()) main();
