#!/usr/bin/env node
// Ablation over a held-out set: the same scanner candidates are measured at four gate levels.
//   1. scanner only        - every L0-valid candidate is treated as published
//   2. + L1                - every citation must pass the deterministic check
//   3. + L1 + L2           - the adversarial verifier must confirm
//   4. + L1 + L2 + L3      - the generated reproducer must fail 3/3 on the analyzed commit
// This is a generalization test, not a benchmark metric: the held-out fixture was never used for tuning.
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "../src/config.mjs";
import { ingest, repoDigest, filesWithLineNumbers } from "../src/ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, validateFindingsL0 } from "../src/scan/index.mjs";
import { checkCitation, verifyOne } from "../src/verify/index.mjs";
import { buildVerifierContext } from "../src/verify/context.mjs";
import { attemptRepro } from "../src/repro/index.mjs";
import { createAgents } from "../src/agents/index.mjs";
import { Budget, gitCommit } from "../src/run/index.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";

function parseArgs(argv) {
  const args = { repo: "bench/held-out", out: "reports/ablations", maxFindings: 12 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo") args.repo = argv[++index];
    else if (token === "--out") args.out = argv[++index];
    else if (token === "--max-findings") args.maxFindings = Number(argv[++index]);
  }
  return args;
}

function overlaps(a, b) {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function buildIndex(expected) {
  const index = [];
  for (const problem of expected.problems) index.push({ kind: "problem", id: problem.id, file: problem.file, startLine: problem.startLine, endLine: problem.endLine });
  for (const trap of expected.traps) index.push({ kind: "trap", id: trap.id, file: trap.file, startLine: trap.startLine, endLine: trap.endLine });
  return index;
}

function matchTarget(finding, index) {
  const evidence = finding && Array.isArray(finding.evidence) && finding.evidence.length > 0 ? finding.evidence[0] : null;
  if (!evidence) return null;
  for (const entry of index) {
    if (entry.file === evidence.path && overlaps(evidence, entry)) return entry;
  }
  return null;
}

function measure(items, selector, index, expected) {
  const published = items.filter(selector);
  let truePositives = 0;
  let falsePositives = 0;
  let trapLeaks = 0;
  const hits = [];
  const seen = new Set();
  for (const item of published) {
    const target = matchTarget(item.finding, index);
    if (target === null) { falsePositives += 1; continue; }
    if (target.kind === "trap") { trapLeaks += 1; falsePositives += 1; hits.push("trap:" + target.id); continue; }
    if (seen.has(target.id)) continue;
    seen.add(target.id);
    truePositives += 1;
    hits.push("problem:" + target.id);
  }
  return {
    published: published.length,
    truePositives: truePositives,
    falsePositives: falsePositives,
    trapLeaks: trapLeaks,
    recall: Number((truePositives / expected.problems.length).toFixed(3)),
    precision: published.length === 0 ? null : Number((truePositives / (truePositives + falsePositives)).toFixed(3)),
    hits: hits
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  if (!config.apiKey) throw new Error("MODEL_API_KEY is required for the ablation run");
  const target = resolve(args.repo);
  const expected = JSON.parse(readFileSync(join(target, "expected.json"), "utf8"));
  const commit = await gitCommit(target);
  const repo = ingest(target, { commit: commit });
  console.log("  repo     " + target + " @ " + String(commit).slice(0, 7) + "  " + repo.files.length + " files / " + repo.loc + " LOC");
  const budget = new Budget(config.budgetUsd);
  const agents = createAgents({
    mock: false, apiKey: config.apiKey, baseUrl: config.baseUrl,
    scannerModel: config.scannerModel, verifierModel: config.verifierModel,
    reproModel: config.reproModel, maxRetries: config.maxRetries, budget: budget
  });
  const started = Date.now();
  const scanCall = await agents.complete({
    role: "scanner",
    messages: buildScannerMessages({ digest: repoDigest(repo), filesWithLineNumbers: filesWithLineNumbers(repo), maxFindings: args.maxFindings }),
    responseFormat: buildScannerResponseFormat(args.maxFindings),
    temperature: config.temperature,
    maxTokens: config.scannerMaxTokens
  });
  const validated = validateFindingsL0(parseDirtyJson(scanCall.text));
  if (!validated.ok) throw new Error("scanner output failed L0: " + validated.errors.join("; "));
  const candidates = validated.findings;
  console.log("  scan     " + candidates.length + " candidate(s), " + validated.rejected.length + " rejected at L0");
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const gateRepo = { root: target, manifest: manifest, commit: commit };
  const index = buildIndex(expected);
  const items = [];
  for (const finding of candidates) {
    const checks = finding.evidence.map(function (evidence) { return checkCitation(evidence, gateRepo); });
    const l1Pass = checks.length > 0 && checks.every(function (check) { return check.passed; });
    const item = { finding: finding, l1: { passed: l1Pass, checks: checks }, l2: null, l3: null };
    if (l1Pass) {
      const context = buildVerifierContext({ repo: repo, finding: finding, maxChars: config.verifierContextChars });
      try {
        item.l2 = await verifyOne({ finding: finding, repo: gateRepo, agent: agents, excerpts: context.text, maxTokens: config.verifierMaxTokens });
      } catch (error) {
        item.l2 = { status: "error", reason: error.message };
      }
      if (item.l2 && item.l2.status === "verified") {
        try {
          item.l3 = await attemptRepro({ finding: finding, agent: agents, repoRoot: target, commit: commit, excerpts: context.text, config: config, outDir: null });
        } catch (error) {
          item.l3 = { status: "inconclusive", reason: error.message };
        }
      }
    }
    items.push(item);
    console.log("    " + finding.id + "  L1 " + (l1Pass ? "pass" : "FAIL") + "  L2 " + (item.l2 ? item.l2.status : "-") + "  L3 " + (item.l3 ? item.l3.status : "-") + "  " + finding.title.slice(0, 60));
  }
  const configs = [
    { name: "scanner only", selector: function () { return true; } },
    { name: "+ L1", selector: function (item) { return item.l1.passed; } },
    { name: "+ L1 + L2", selector: function (item) { return item.l2 && item.l2.status === "verified"; } },
    { name: "+ L1 + L2 + L3", selector: function (item) { return item.l3 && item.l3.status === "reproduced"; } }
  ];
  const metrics = configs.map(function (entry) {
    return { name: entry.name, metrics: measure(items, entry.selector, index, expected) };
  });
  const report = {
    repo: { path: target, commit: commit, files: repo.files.length, loc: repo.loc },
    expected: { problems: expected.problems.length, traps: expected.traps.length },
    candidates: items.map(function (item) {
      return { id: item.finding.id, title: item.finding.title, severity: item.finding.severity,
        l1: item.l1, l2: item.l2 ? { status: item.l2.status, reason: item.l2.verifier ? item.l2.verifier.reason : null } : null,
        l3: item.l3 ? { status: item.l3.status, classification: item.l3.classification, reason: item.l3.reason } : null };
    }),
    configs: metrics,
    costUsd: budget.spentUsd,
    durationMs: Date.now() - started
  };
  const outDir = resolve(args.out, "held-out-" + String(commit).slice(0, 7));
  const finalDir = existsSync(outDir) ? outDir + "-" + Date.now().toString(36) : outDir;
  mkdirSync(finalDir, { recursive: true });
  writeFileSync(join(finalDir, "ablation.json"), JSON.stringify(report, null, 2) + "\n");
  const table = [
    "# Ablation on the held-out set",
    "",
    "Repo `" + target + "` @ `" + String(commit).slice(0, 7) + "`; " + expected.problems.length + " defects, " + expected.traps.length + " traps.",
    "",
    "| Configuration | Published | True positives | False positives | Trap leaks | Recall | Precision |",
    "|---|---:|---:|---:|---:|---:|---:|"
  ];
  for (const entry of metrics) {
    const m = entry.metrics;
    table.push("| " + entry.name + " | " + m.published + " | " + m.truePositives + " | " + m.falsePositives + " | " + m.trapLeaks + " | " + m.recall + " | " + (m.precision === null ? "n/a" : m.precision) + " |");
  }
  table.push("");
  table.push("Measured cost: $" + budget.spentUsd.toFixed(4) + "; duration " + (report.durationMs / 1000).toFixed(1) + " s.");
  table.push("");
  table.push("Every published finding is listed in `ablation.json` with its L1/L2/L3 outcome.");
  writeFileSync(join(finalDir, "ABLATION.md"), table.join("\n") + "\n");
  console.log("");
  console.log(table.slice(4, 10).join("\n"));
  console.log("");
  console.log("  written  " + finalDir);
  console.log("  cost     $" + budget.spentUsd.toFixed(4));
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});