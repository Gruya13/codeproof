#!/usr/bin/env node
// Reverse cross-examination: take the findings produced by one model and run them through the
// OTHER model as adversarial verifier (the CodeProof L2 gate). Answers: would the additional
// findings survive a second model, or is a single stronger model just noisier?
//
// The input is model-ablation.json (summaries). For L1-valid citations the committed snippet is
// reconstructed from the analyzed snapshot at the cited range, which is exactly what the first
// model cited (L1 verified it). Each finding then gets the normal bounded verifier context.
import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, costOf } from "../src/config.mjs";
import { ingest } from "../src/ingest/index.mjs";
import { verifyOne } from "../src/verify/index.mjs";
import { buildVerifierContext } from "../src/verify/context.mjs";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { gitCommit, readFileAtCommit } from "../src/run/index.mjs";

function parseArgs(argv) {
  const args = { repo: null, ablation: null, variant: "wonder-only", model: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo") args.repo = argv[++index];
    else if (token === "--ablation") args.ablation = argv[++index];
    else if (token === "--variant") args.variant = argv[++index];
    else if (token === "--model") args.model = argv[++index];
    else if (token === "--out") args.out = argv[++index];
  }
  if (!args.repo || !args.ablation) throw new Error("--repo and --ablation <model-ablation.json> are required");
  return args;
}

// Older ablation JSON files store only a human-readable "where" string (path:start-end, ...).
function parseWhere(where) {
  return String(where || "").split(", ").map(function (part) {
    const match = part.match(/^(.*):(\d+)-(\d+)$/);
    if (!match) return null;
    return { path: match[1], startLine: Number(match[2]), endLine: Number(match[3]) };
  }).filter(Boolean);
}

function reconstructEvidence(summary, target, commit) {
  const raw = Array.isArray(summary.evidence) && summary.evidence.length > 0 ? summary.evidence : parseWhere(summary.where);
  return raw.map(function (entry) {
    const source = readFileAtCommit(target, commit, entry.path);
    const lines = source === null ? [] : source.split("\n");
    const snippet = lines.slice(entry.startLine - 1, entry.endLine).join("\n");
    return { path: entry.path, startLine: entry.startLine, endLine: entry.endLine, snippet: snippet };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  if (!config.apiKey) throw new Error("MODEL_API_KEY is required");
  const target = resolve(args.repo);
  const commit = await gitCommit(target);
  const repo = ingest(target, { commit: commit });
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const gateRepo = { root: target, manifest: manifest, commit: commit };
  const ablation = JSON.parse(readFileSync(resolve(args.ablation), "utf8"));
  const source = ablation.variants.find(function (item) { return item.variant === args.variant && !item.error; });
  if (!source) throw new Error("variant not found: " + args.variant);
  const model = args.model || config.scannerModel;
  const complete = createMetaAgent({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: model, maxRetries: config.maxRetries });
  const agent = { complete: function (request) { return complete(request); } };
  console.log("  repo     " + target + " @ " + String(commit).slice(0, 7));
  console.log("  source   " + args.variant + " (" + source.candidates + " candidates)");
  console.log("  verifier " + model);
  const results = [];
  let cost = 0;
  const started = Date.now();
  for (const summary of source.findings || []) {
    const evidence = reconstructEvidence(summary, target, commit);
    const finding = { id: summary.id, title: summary.title, claim: summary.claim, evidence: evidence, severity: summary.severity || "medium", confidence: 0.8 };
    const context = buildVerifierContext({ repo: repo, finding: finding, maxChars: config.verifierContextChars });
    let outcome;
    try {
      outcome = await verifyOne({ finding: finding, repo: gateRepo, agent: agent, excerpts: context.text, maxTokens: config.verifierMaxTokens });
    } catch (error) {
      results.push({ id: summary.id, where: summary.where, status: "error", reason: error.message });
      continue;
    }
    // verifyOne does not expose the agent call cost; estimate from the call log is unavailable here,
    // so the cost is reported by the caller command (budget) only when the adapter is wrapped.
    results.push({ id: summary.id, where: summary.where, status: outcome.status, verdict: outcome.verifier ? outcome.verifier.verdict : null, mode: outcome.verifier ? outcome.verifier.mode : null, reason: outcome.verifier ? outcome.verifier.reason : null });
    console.log("    " + summary.id + "  " + outcome.status + "  " + summary.where);
  }
  const confirmed = results.filter(function (item) { return item.status === "verified"; }).length;
  const refuted = results.filter(function (item) { return item.status === "refuted"; }).length;
  const moderate = results.filter(function (item) { return item.status === "moderate"; }).length;
  const uncertain = results.filter(function (item) { return item.status === "uncertain"; }).length;
  const report = {
    repo: { path: target, commit: commit },
    sourceVariant: args.variant, verifierModel: model,
    totals: { candidates: results.length, confirmed: confirmed, refuted: refuted, moderate: moderate, uncertain: uncertain },
    results: results,
    durationMs: Date.now() - started
  };
  if (args.out) {
    const outPath = resolve(args.out);
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    console.log("  written  " + outPath);
  }
  console.log("");
  console.log("  reverse verification: " + confirmed + " confirmed, " + refuted + " refuted, " + moderate + " moderate, " + uncertain + " uncertain");
  console.log("  duration " + ((Date.now() - started) / 1000).toFixed(1) + " s");
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});