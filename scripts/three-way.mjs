#!/usr/bin/env node
// Three-way comparison on one task: CodeProof (Spark scan -> L1 -> Wonder verify -> L3) vs Spark alone
// vs Wonder alone. Spark and Wonder are used here as standalone scanners: one model call, no
// verification of any kind. They are scored on the same ground truth (bench/expected.json) with the
// same matcher as the official benchmark, so the numbers are directly comparable.
//
// Important: the benchmark's ground-truth matcher is position-based (file + line overlap). For the
// standalone scanners this measures *scanner recall* (problems mentioned, unverified) and the number
// of candidate claims that point at traps or at nothing. Only CodeProof produces *verified* recall.
import { basename, resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, costOf } from "../src/config.mjs";
import { ingest, repoDigest, buildScannerInput } from "../src/ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, validateFindingsL0 } from "../src/scan/index.mjs";
import { checkCitation } from "../src/verify/index.mjs";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { gitCommit } from "../src/run/index.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";
import { buildIndex, matchTarget, scoreRun } from "../bench/score.mjs";

function parseArgs(argv) {
  const args = { repo: null, expected: "bench/expected.json", codeproofRun: null, out: "reports/three-way", runs: 1, maxFindings: 12 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo") { args.repo = argv[index + 1]; index += 1; }
    else if (token === "--expected") { args.expected = argv[index + 1]; index += 1; }
    else if (token === "--codeproof-run") { args.codeproofRun = argv[index + 1]; index += 1; }
    else if (token === "--out") { args.out = argv[index + 1]; index += 1; }
    else if (token === "--runs") { args.runs = Number(argv[index + 1]); index += 1; }
    else if (token === "--max-findings") { args.maxFindings = Number(argv[index + 1]); index += 1; }
    else throw new Error("unknown option: " + token);
  }
  if (!args.repo) throw new Error("--repo is required");
  return args;
}

function scannerMetrics(expected, candidates) {
  const index = buildIndex(expected);
  const problems = new Set();
  const traps = new Set();
  const extras = new Set();
  let onProblem = 0;
  let onTrap = 0;
  let onExtra = 0;
  let unmatched = 0;
  for (const candidate of candidates) {
    const evidence = candidate && Array.isArray(candidate.evidence) ? candidate.evidence[0] : null;
    const target = matchTarget(evidence, index);
    if (target === null) { unmatched += 1; continue; }
    if (target.kind === "problem") { problems.add(target.id); onProblem += 1; }
    else if (target.kind === "trap") { traps.add(target.id); onTrap += 1; }
    else { extras.add(target.id); onExtra += 1; }
  }
  const claimsOnRealProblems = onProblem;
  const falseClaims = onTrap + unmatched;
  const precision = claimsOnRealProblems + falseClaims > 0 ? claimsOnRealProblems / (claimsOnRealProblems + falseClaims) : null;
  return {
    candidates: candidates.length,
    problemsHit: problems.size,
    problemsTotal: expected.problems.length,
    scannerRecall: expected.problems.length > 0 ? problems.size / expected.problems.length : null,
    claimsOnProblems: onProblem,
    claimsOnTraps: onTrap,
    claimsOnExtraTrue: onExtra,
    claimsUnmatched: unmatched,
    trapsHit: traps.size,
    extrasHit: extras.size,
    precisionAtCandidateLevel: precision
  };
}

async function runStandalone(name, model, config, scanMessages, responseFormat, gateRepo, expected, runs) {
  const complete = createMetaAgent({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: model, maxRetries: config.maxRetries });
  const attempts = [];
  for (let run = 1; run <= runs; run += 1) {
    const started = Date.now();
    try {
      const request = { role: "scanner", messages: scanMessages, responseFormat: responseFormat, temperature: 0, maxTokens: config.scannerMaxTokens };
      let call = await complete(request);
      if (call.finishReason === "length") {
        const retry = await complete(Object.assign({}, request, { maxTokens: config.scannerMaxTokens * 2 }));
        retry.usage = {
          inputTokens: (call.usage.inputTokens || 0) + (retry.usage.inputTokens || 0),
          outputTokens: (call.usage.outputTokens || 0) + (retry.usage.outputTokens || 0),
          cachedTokens: (call.usage.cachedTokens || 0) + (retry.usage.cachedTokens || 0)
        };
        call = retry;
      }
      let parsed;
      try { parsed = parseDirtyJson(call.text); }
      catch (error) {
        attempts.push({ run: run, error: "unparseable output: " + error.message, finishReason: call.finishReason, durationMs: Date.now() - started, costUsd: costOf(model, call.usage) });
        continue;
      }
      const validated = validateFindingsL0(parsed);
      const candidates = validated.findings;
      const l1 = candidates.map(function (finding) { return checkCitation(finding.evidence[0], gateRepo); });
      const l1Valid = candidates.filter(function (finding, index) { return l1[index].passed; });
      const metrics = scannerMetrics(expected, l1Valid);
      attempts.push(Object.assign({
        run: run,
        model: model,
        usage: call.usage,
        costUsd: costOf(model, call.usage),
        durationMs: Date.now() - started,
        finishReason: call.finishReason,
        candidates: candidates.length,
        l1Rejected: candidates.length - l1Valid.length
      }, metrics));
      console.log("    " + name + " run " + run + ": " + metrics.candidates + " candidates (" + metrics.problemsHit + "/" + metrics.problemsTotal + " problems, " + metrics.claimsUnmatched + " unmatched, " + metrics.claimsOnTraps + " on traps), $" + costOf(model, call.usage).toFixed(4) + ", " + Math.round((Date.now() - started) / 1000) + " s");
    } catch (error) {
      attempts.push({ run: run, error: error.message, durationMs: Date.now() - started });
      console.log("    " + name + " run " + run + " ERROR " + error.message.slice(0, 120));
    }
  }
  const ok = attempts.filter(function (attempt) { return !attempt.error; });
  const mean = function (key) {
    const values = ok.map(function (attempt) { return attempt[key]; }).filter(function (value) { return typeof value === "number" && !Number.isNaN(value); });
    return values.length === 0 ? null : values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  };
  return {
    name: name,
    model: model,
    runs: attempts,
    aggregate: {
      validRuns: ok.length,
      costUsd: ok.length === 0 ? null : ok.reduce(function (sum, attempt) { return sum + (attempt.costUsd || 0); }, 0),
      durationMs: mean("durationMs"),
      candidates: mean("candidates"),
      scannerRecall: mean("scannerRecall"),
      problemsHit: mean("problemsHit"),
      claimsUnmatched: mean("claimsUnmatched"),
      claimsOnTraps: mean("claimsOnTraps"),
      precisionAtCandidateLevel: mean("precisionAtCandidateLevel")
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  if (config.mock) throw new Error("three-way needs a real MODEL_API_KEY (not mock mode)");
  const target = resolve(args.repo);
  const expected = JSON.parse(readFileSync(args.expected, "utf8"));
  const commit = await gitCommit(target);
  const repo = ingest(target, { commit: commit });
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const gateRepo = { root: target, manifest: manifest, commit: commit };
  const scannerInput = buildScannerInput(repo);
  const scanMessages = buildScannerMessages({ digest: repoDigest(repo), filesWithLineNumbers: scannerInput.text, maxFindings: args.maxFindings });
  const responseFormat = buildScannerResponseFormat(args.maxFindings);
  console.log("Three-way comparison on " + target + " @ " + String(commit).slice(0, 7) + " (" + repo.files.length + " files / " + repo.loc + " LOC)");
  const spark = await runStandalone("spark-alone", config.scannerModel, config, scanMessages, responseFormat, gateRepo, expected, args.runs);
  const wonder = await runStandalone("wonder-alone", config.verifierModel, config, scanMessages, responseFormat, gateRepo, expected, args.runs);
  let codeproof = null;
  if (args.codeproofRun) {
    const runDir = resolve(args.codeproofRun);
    const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
    const findings = JSON.parse(readFileSync(join(runDir, "findings.json"), "utf8"));
    const candidatesDoc = JSON.parse(readFileSync(join(runDir, "candidates.json"), "utf8"));
    const scannerCandidates = (candidatesDoc.candidates || []).filter(function (item) { return item.status !== "l0-rejected"; }).map(function (item) { return item.candidate; });
    codeproof = {
      runDir: runDir,
      run: run,
      verified: scoreRun(expected, findings),
      scanner: scannerMetrics(expected, scannerCandidates)
    };
  }
  const lines = [];
  lines.push("# Three-way comparison — same task, three architectures");
  lines.push("");
  lines.push("Task: " + basename(target) + " @ " + String(commit).slice(0, 7) + " — " + repo.files.length + " files / " + repo.loc + " LOC; ground truth: " + expected.problems.length + " problems, " + expected.traps.length + " traps, " + expected.extraTrue.length + " extraTrue.");
  lines.push("");
  lines.push("| Variant | Candidates | Problems hit (scanner recall) | Verified recall | Precision | Unmatched claims | Claims on traps | Cost | Duration |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const variant of [spark, wonder]) {
    const a = variant.aggregate;
    lines.push("| " + variant.name + " (`" + variant.model + "`) | " + fmt(a.candidates) + " | " + fmt(a.problemsHit) + "/" + expected.problems.length + " (" + fmtPercent(a.scannerRecall) + ") | n/a — no verification | " + fmtPercent(a.precisionAtCandidateLevel) + " | " + fmt(a.claimsUnmatched) + " | " + fmt(a.claimsOnTraps) + " | $" + fmtMoney(a.costUsd) + " | " + fmtSeconds(a.durationMs) + " |");
  }
  if (codeproof) {
    const v = codeproof.verified;
    const s = codeproof.scanner;
    lines.push("| codeproof (`spark + wonder + L3`) | " + s.candidates + " | " + s.problemsHit + "/" + expected.problems.length + " (" + fmtPercent(s.scannerRecall) + ") | **" + v.verifiedTp + "/" + expected.problems.length + "** | **" + fmtPercent(v.precision) + "** (verified-only) | " + (v.verifiedFp) + " FP | " + v.trapsVerified + "/" + expected.traps.length + " verified | $" + fmtMoney(codeproof.run.usage.costUsd) + " | " + fmtSeconds(codeproof.run.timings.durationMs) + " |");
  }
  lines.push("");
  lines.push("Caveat: the standalone models only *propose*; none of their candidates is verified, so their recall is scanner recall and their \"precision\" is a position-level estimate, not a verified metric. CodeProof's recall/precision are verified-only, computed from findings.json status by the frozen benchmark scorer.");
  const summary = { repo: target, commit: commit, files: repo.files.length, loc: repo.loc, spark: spark, wonder: wonder, codeproof: codeproof, generatedAt: new Date().toISOString() };
  const outDir = resolve(args.out, basename(target) + "-" + String(commit).slice(0, 7) + "-" + Date.now().toString(36));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "three-way.json"), JSON.stringify(summary, null, 2) + "\n");
  writeFileSync(join(outDir, "REPORT.md"), lines.join("\n") + "\n");
  console.log("");
  console.log(lines.join("\n"));
  console.log("");
  console.log("  written  " + outDir);
}

function fmt(value) { return value === null || value === undefined ? "n/a" : (Math.round(value * 100) / 100).toString(); }
function fmtPercent(value) { return value === null || value === undefined ? "n/a" : Math.round(value * 1000) / 10 + "%"; }
function fmtMoney(value) { return value === null || value === undefined ? "n/a" : Number(value).toFixed(4); }
function fmtSeconds(value) { return value === null || value === undefined ? "n/a" : Math.round(value / 1000) + " s"; }

main().catch(function (error) { console.error("ERROR: " + error.message); process.exitCode = 1; });