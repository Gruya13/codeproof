#!/usr/bin/env node
// Chunked scanner: slice the repository by top-level directory and scan each slice with the SAME
// scanner prompt and model. Motivation: on a large real repository the single-pass scanner
// proposes only 8-9 candidates; a per-directory scan gives the model a smaller, focused context
// for every call, at a fraction of the cost of a second model scan.
// This measures SCANNER recall (candidates matched against the ground truth before L2/L3), not
// published recall. It is an experiment, not part of the pipeline.
import { basename, resolve, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, costOf } from "../src/config.mjs";
import { ingest, repoDigest, buildScannerInput } from "../src/ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, validateFindingsL0 } from "../src/scan/index.mjs";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { gitCommit } from "../src/run/index.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";
import { buildIndex, matchTarget } from "../bench/score.mjs";

function parseArgs(argv) {
  const args = { repo: null, expected: null, out: "reports/chunked-scan", maxFindings: 20, runs: 1, model: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--repo") { args.repo = argv[i + 1]; i += 1; }
    else if (token === "--expected") { args.expected = argv[i + 1]; i += 1; }
    else if (token === "--out") { args.out = argv[i + 1]; i += 1; }
    else if (token === "--max-findings") { args.maxFindings = Number(argv[i + 1]); i += 1; }
    else if (token === "--runs") { args.runs = Number(argv[i + 1]); i += 1; }
    else if (token === "--model") { args.model = argv[i + 1]; i += 1; }
    else throw new Error("unknown option: " + token);
  }
  if (!args.repo) throw new Error("--repo is required");
  return args;
}

function subRepo(repo, files) {
  const paths = new Set(files.map(function (file) { return file.path; }));
  const edges = repo.edges.filter(function (edge) { return paths.has(edge.from) && paths.has(edge.to); });
  const cycles = repo.cycles.filter(function (cycle) { return cycle.every(function (path) { return paths.has(path); }); });
  return {
    root: repo.root, sources: repo.sources, commit: repo.commit, files: files,
    loc: files.reduce(function (sum, file) { return sum + file.loc; }, 0),
    edges: edges, cycles: cycles
  };
}

function scannerMetrics(expected, candidates) {
  const index = buildIndex(expected);
  const problems = new Set();
  const traps = new Set();
  let onProblem = 0, onTrap = 0, unmatched = 0;
  for (const candidate of candidates) {
    const evidence = candidate && Array.isArray(candidate.evidence) ? candidate.evidence[0] : null;
    const target = matchTarget(evidence, index);
    if (!target) { unmatched += 1; continue; }
    if (target.kind === "problem") { problems.add(target.id); onProblem += 1; }
    else if (target.kind === "trap") { traps.add(target.id); onTrap += 1; }
  }
  return {
    candidates: candidates.length,
    problemsHit: problems.size,
    problemsTotal: expected.problems.length,
    scannerRecall: expected.problems.length > 0 ? problems.size / expected.problems.length : null,
    claimsOnProblems: onProblem,
    claimsOnTraps: onTrap,
    claimsUnmatched: unmatched
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  const target = resolve(args.repo);
  const commit = await gitCommit(target);
  const repo = ingest(target, { commit: commit });
  const rawExpected = args.expected ? JSON.parse(readFileSync(args.expected, "utf8")) : null;
  // The calibration set stores `problems`, the extended set stores `defects`; normalize both.
  const expected = rawExpected ? {
    problems: (rawExpected.problems || rawExpected.defects || []).map(function (item) {
      return { id: item.id, file: item.file, startLine: item.startLine, endLine: item.endLine };
    }),
    traps: rawExpected.traps || [],
    extraTrue: rawExpected.extraTrue || []
  } : null;
  const model = args.model || config.scannerModel;
  const complete = createMetaAgent({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: model, maxRetries: config.maxRetries });
  const groups = new Map();
  for (const file of repo.files) {
    const parts = file.path.split("/");
    const key = parts.length > 1 ? parts[0] : "(root)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  const groupNames = Array.from(groups.keys()).sort();
  console.log("Chunked scan of " + target + " @ " + String(commit).slice(0, 7) + " with " + model);
  console.log("  " + repo.files.length + " files / " + repo.loc + " LOC in " + groupNames.length + " groups: " + groupNames.join(", "));
  const allCandidates = [];
  const groupResults = [];
  let totalCost = 0;
  for (const name of groupNames) {
    const files = groups.get(name);
    const chunk = subRepo(repo, files);
    const scannerInput = buildScannerInput(chunk);
    const messages = buildScannerMessages({ digest: repoDigest(chunk), filesWithLineNumbers: scannerInput.text, maxFindings: args.maxFindings });
    const started = Date.now();
    let call;
    try {
      const request = { role: "scanner", messages: messages, responseFormat: buildScannerResponseFormat(args.maxFindings), temperature: 0, maxTokens: config.scannerMaxTokens };
      call = await complete(request);
      if (call.finishReason === "length") {
        const retry = await complete(Object.assign({}, request, { maxTokens: config.scannerMaxTokens * 2 }));
        retry.usage = { inputTokens: (call.usage.inputTokens || 0) + (retry.usage.inputTokens || 0), outputTokens: (call.usage.outputTokens || 0) + (retry.usage.outputTokens || 0), cachedTokens: (call.usage.cachedTokens || 0) + (retry.usage.cachedTokens || 0) };
        call = retry;
      }
    } catch (error) {
      groupResults.push({ group: name, files: files.length, loc: chunk.loc, error: error.message });
      console.log("  " + name.padEnd(10) + " ERROR " + error.message.slice(0, 100));
      continue;
    }
    const cost = costOf(model, call.usage);
    totalCost += cost || 0;
    let parsed, validated;
    try {
      parsed = parseDirtyJson(call.text);
      validated = validateFindingsL0(parsed);
    } catch (error) {
      groupResults.push({ group: name, files: files.length, loc: chunk.loc, error: "unparseable: " + error.message, costUsd: cost, durationMs: Date.now() - started });
      console.log("  " + name.padEnd(10) + " unparseable (" + call.finishReason + ")");
      continue;
    }
    const candidates = validated.findings;
    allCandidates.push.apply(allCandidates, candidates);
    groupResults.push({ group: name, files: files.length, loc: chunk.loc, candidates: candidates.length, costUsd: cost, durationMs: Date.now() - started, finishReason: call.finishReason });
    console.log("  " + name.padEnd(10) + " " + String(files.length).padStart(3) + " files / " + String(chunk.loc).padStart(5) + " LOC -> " + String(candidates.length).padStart(2) + " candidates, $" + (cost || 0).toFixed(4) + ", " + Math.round((Date.now() - started) / 1000) + " s");
  }
  const metrics = expected ? scannerMetrics(expected, allCandidates) : null;
  const summary = { repo: target, commit: commit, model: model, groups: groupResults, candidatesTotal: allCandidates.length, costUsd: totalCost, scannerMetrics: metrics };
  const outDir = resolve(args.out, basename(target) + "-" + String(commit).slice(0, 7) + "-" + Date.now().toString(36));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "chunked-scan.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log("");
  if (metrics) {
    console.log("SCANNER RECALL: " + metrics.problemsHit + "/" + metrics.problemsTotal + " (" + Math.round(metrics.scannerRecall * 1000) / 10 + "%), " + metrics.candidates + " candidates, " + metrics.claimsUnmatched + " unmatched, " + metrics.claimsOnTraps + " on traps");
  }
  console.log("  total cost $" + totalCost.toFixed(4) + " | written " + outDir);
}

main().catch(function (error) { console.error("ERROR: " + error.message); process.exitCode = 1; });