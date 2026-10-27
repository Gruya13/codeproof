#!/usr/bin/env node
// Model ablation on one repository: Spark alone, Wonder alone, and the full CodeProof gate.
// All variants receive the same scanner prompt, schema and repository digest, so the only
// difference is the architecture (one model vs producer+verifier vs producer+verifier+L3).
// Spark-only and Wonder-only candidates are additionally checked with L1 (a deterministic check,
// not a model) so the citation quality of both models can be compared on equal terms.
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, costOf } from "../src/config.mjs";
import { ingest, repoDigest, filesWithLineNumbers } from "../src/ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, validateFindingsL0 } from "../src/scan/index.mjs";
import { checkCitation } from "../src/verify/index.mjs";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { gitCommit } from "../src/run/index.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";

function parseArgs(argv) {
  const args = { repo: null, out: "reports/model-ablation", codeproofRun: null, runs: 1, maxFindings: 8 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo") args.repo = argv[++index];
    else if (token === "--out") args.out = argv[++index];
    else if (token === "--codeproof-run") args.codeproofRun = argv[++index];
    else if (token === "--runs") args.runs = Number(argv[++index]);
    else if (token === "--max-findings") args.maxFindings = Number(argv[++index]);
  }
  if (!args.repo) throw new Error("--repo <path> is required");
  return args;
}

function overlaps(left, right) {
  return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

function sameFinding(left, right) {
  const a = left.evidence && left.evidence[0];
  const b = right.evidence && right.evidence[0];
  if (!a || !b) return false;
  return a.path === b.path && overlaps(a, b);
}

function describe(finding) {
  return finding.evidence.map(function (e) { return e.path + ":" + e.startLine + "-" + e.endLine; }).join(", ");
}

function l1Check(finding, gateRepo) {
  const checks = (finding.evidence || []).map(function (evidence) { return checkCitation(evidence, gateRepo); });
  return { passed: checks.length > 0 && checks.every(function (check) { return check.passed; }), checks: checks };
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
  const scanMessages = buildScannerMessages({ digest: repoDigest(repo), filesWithLineNumbers: filesWithLineNumbers(repo), maxFindings: args.maxFindings });
  const responseFormat = buildScannerResponseFormat(args.maxFindings);
  console.log("  repo     " + target + " @ " + String(commit).slice(0, 7) + "  " + repo.files.length + " files / " + repo.loc + " LOC");
  const codeProofFindings = args.codeproofRun && existsSync(join(args.codeproofRun, "findings.json"))
    ? JSON.parse(readFileSync(join(args.codeproofRun, "findings.json"), "utf8"))
    : [];
  const variants = [
    { name: "spark-only", model: config.scannerModel, role: "scanner" },
    { name: "wonder-only", model: config.verifierModel, role: "scanner" }
  ];
  const results = [];
  for (const variant of variants) {
    const complete = createMetaAgent({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: variant.model, maxRetries: config.maxRetries });
    for (let run = 1; run <= args.runs; run += 1) {
      const started = Date.now();
      let call;
      try {
        const request = { role: variant.role, messages: scanMessages, responseFormat: responseFormat, temperature: 0, maxTokens: config.scannerMaxTokens };
        call = await complete(request);
        // a single model can produce a longer answer than the scanner budget; retry once with a doubled budget
        if (call.finishReason === "length") {
          const retry = await complete({ ...request, maxTokens: config.scannerMaxTokens * 2 });
          retry.usage = {
            inputTokens: (call.usage.inputTokens || 0) + (retry.usage.inputTokens || 0),
            outputTokens: (call.usage.outputTokens || 0) + (retry.usage.outputTokens || 0),
            cachedTokens: (call.usage.cachedTokens || 0) + (retry.usage.cachedTokens || 0)
          };
          call = retry;
        }
      } catch (error) {
        results.push({ variant: variant.name, model: variant.model, run: run, error: error.message });
        console.log("    " + variant.name + " run " + run + " ERROR " + error.message.slice(0, 120));
        continue;
      }
      const durationMs = Date.now() - started;
      let parsed = null;
      let validated = null;
      try {
        parsed = parseDirtyJson(call.text);
        validated = validateFindingsL0(parsed);
      } catch (error) {
        results.push({ variant: variant.name, model: variant.model, run: run, error: "unparseable output: " + error.message, durationMs: durationMs, costUsd: costOf(variant.model, call.usage) });
        console.log("    " + variant.name + " run " + run + " unparseable (" + call.finishReason + ")");
        continue;
      }
      const candidates = validated.findings.map(function (finding) {
        const check = l1Check(finding, gateRepo);
        return { finding: finding, l1: check };
      });
      const l1Valid = candidates.filter(function (item) { return item.l1.passed; });
      const overlap = l1Valid.filter(function (item) {
        return codeProofFindings.some(function (published) { return sameFinding(item.finding, published.finding); });
      });
      const fresh = l1Valid.filter(function (item) {
        return !codeProofFindings.some(function (published) { return sameFinding(item.finding, published.finding); });
      });
      const entry = {
        variant: variant.name, model: variant.model, run: run,
        calls: 1, durationMs: durationMs,
        costUsd: costOf(variant.model, call.usage), usage: call.usage,
        finishReason: call.finishReason,
        candidates: candidates.length,
        l0Valid: validated.findings.length,
        l1Valid: l1Valid.length,
        overlapWithCodeProof: overlap.length,
        newVsCodeProof: fresh.length,
        findings: candidates.map(function (item) {
          return { id: item.finding.id, title: item.finding.title, claim: item.finding.claim, severity: item.finding.severity, where: describe(item.finding), l1: item.l1.passed, evidence: item.finding.evidence };
        })
      };
      results.push(entry);
      console.log("    " + variant.name + " run " + run + ": " + candidates.length + " candidates, " + l1Valid.length + " L1-valid, " + overlap.length + " overlap CodeProof, " + fresh.length + " new, $" + entry.costUsd.toFixed(4) + ", " + (durationMs / 1000).toFixed(1) + " s");
    }
  }
  const report = {
    repo: { path: target, commit: commit, files: repo.files.length, loc: repo.loc },
    codeproofRun: args.codeproofRun,
    codeProof: {
      published: codeProofFindings.length,
      verified: codeProofFindings.filter(function (item) { return item.status === "verified"; }).length,
      reproduced: codeProofFindings.filter(function (item) { return item.repro && item.repro.status === "reproduced"; }).length,
      findings: codeProofFindings.map(function (item) { return { id: item.finding.id, title: item.finding.title, where: describe(item.finding) }; })
    },
    variants: results
  };
  const outDir = resolve(args.out, "ufo-" + String(commit).slice(0, 7) + "-" + Date.now().toString(36));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "model-ablation.json"), JSON.stringify(report, null, 2) + "\n");
  const lines = [
    "# Model ablation — Spark alone vs Wonder alone vs CodeProof",
    "",
    "Repo `" + target + "` @ `" + String(commit).slice(0, 7) + "`; same scanner prompt, schema and digest for every variant.",
    "",
    "| Variant | Model | Runs | Candidates | L1-valid | Overlap with CodeProof | New vs CodeProof | Cost | Time |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|"
  ];
  for (const result of results.filter(function (item) { return !item.error; })) {
    lines.push("| " + result.variant + " | `" + result.model + "` | " + result.run + " | " + result.candidates + " | " + result.l1Valid + " | " + result.overlapWithCodeProof + " | " + result.newVsCodeProof + " | $" + result.costUsd.toFixed(4) + " | " + (result.durationMs / 1000).toFixed(1) + " s |");
  }
  lines.push("| codeproof (full gate) | spark + wonder | - | " + report.codeProof.published + " | " + report.codeProof.verified + " verified | - | - | (existing run) | - |");
  writeFileSync(join(outDir, "MODEL-ABLATION.md"), lines.join("\n") + "\n");
  console.log("");
  console.log(lines.join("\n"));
  console.log("");
  console.log("  written  " + outDir);
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});