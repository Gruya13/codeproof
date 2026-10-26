#!/usr/bin/env node
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, computeConfigSha256, VERSION } from "./config.mjs";
import { ingest, repoDigest, filesWithLineNumbers } from "./ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, scannerSystemPrompt, validateFindingsL0 } from "./scan/index.mjs";
import { verifyOne, VERIFIER_SYSTEM_PROMPT } from "./verify/index.mjs";
import { buildVerifierContext } from "./verify/context.mjs";
import { buildReport, buildRejected } from "./synthesize/index.mjs";
import { parseDirtyJson } from "./run/json.mjs";
import { computeRunId, sha256Hex, gitCommit, repoIsClean, Budget } from "./run/index.mjs";
import { createAgents } from "./agents/index.mjs";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { command: argv[0], target: null, mock: false, out: "reports", candidates: null, mode: null };
  const rest = argv.slice(1);
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--mock") {
      args.mock = true;
    } else if (arg === "--out") {
      args.out = rest[index + 1];
      index += 1;
    } else if (arg === "--candidates") {
      args.candidates = rest[index + 1];
      index += 1;
    } else if (arg === "--mode") {
      args.mode = rest[index + 1];
      index += 1;
    } else if (args.target === null) {
      args.target = arg;
    } else {
      throw new Error("unexpected argument: " + arg);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const controlled = args.candidates !== null;
  if (args.command !== "analyze" && args.command !== "controlled-verifier") {
    console.log("usage: node src/cli.mjs analyze <path> [--mock] [--out <dir>] [--mode demo|bench|smoke]");
    console.log("       node src/cli.mjs controlled-verifier <path> --candidates <file> [--out <dir>]");
    process.exitCode = 2;
    return;
  }
  if (args.command === "controlled-verifier" && !controlled) {
    throw new Error("--candidates <file> is required for controlled-verifier mode");
  }
  loadDotEnv(resolve(".env"));
  const config = loadConfig(process.env);
  const mock = args.mock || config.mock;
  if (!mock && !config.apiKey) {
    throw new Error("MODEL_API_KEY is not set. Use --mock for an offline demo, or export MODEL_API_KEY for a real run.");
  }
  if (controlled && mock) {
    throw new Error("controlled-verifier mode needs the real API; do not use --mock");
  }
  const mode = args.mode || (controlled ? "controlled-verifier" : (mock ? "demo" : "smoke"));
  if (["demo", "bench", "smoke", "controlled-verifier"].indexOf(mode) === -1) {
    throw new Error("unknown --mode " + mode + " (expected demo, bench, smoke or controlled-verifier)");
  }
  if (mode === "bench" && mock) {
    throw new Error("bench mode needs the real API; do not use --mock");
  }
  if (controlled && mode !== "controlled-verifier") {
    throw new Error("controlled-verifier runs must use mode controlled-verifier");
  }
  const target = resolve(args.target || "fixtures/mini-repo");
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const phases = [];
  const models = controlled ? [config.verifierModel] : [config.scannerModel, config.verifierModel];
  const configSha256 = computeConfigSha256(config, mode);
  const commit = await gitCommit(target);
  const dirty = !(await repoIsClean(target));
  if (mode === "bench" && dirty) {
    throw new Error("bench mode requires a clean working tree under " + target + " (commit or stash changes first)");
  }
  if (dirty) {
    console.warn("  WARN working tree is dirty under " + target + "; run.json records repo.dirty=true");
  }
  const scannerPrompt = scannerSystemPrompt(config.maxFindings);
  const prompts = controlled
    ? [{ role: "verifier", version: "v1", sha256: sha256Hex(VERIFIER_SYSTEM_PROMPT) }]
    : [
        { role: "scanner-correctness", version: "v3", sha256: sha256Hex(scannerPrompt) },
        { role: "verifier", version: "v1", sha256: sha256Hex(VERIFIER_SYSTEM_PROMPT) }
      ];
  const runId = computeRunId({
    commit: commit,
    configSha256: configSha256,
    models: models,
    prompts: prompts.map(function (prompt) { return prompt.role + ":" + prompt.version + ":" + prompt.sha256; })
  });
  const budget = new Budget(config.budgetUsd);
  console.log("");
  if (mock) {
    console.log("  *************************************************************");
    console.log("  *  MOCK MODE - synthetic output, no network, no model calls  *");
    console.log("  *************************************************************");
  }
  if (controlled) {
    console.log("  *************************************************************");
    console.log("  *  CONTROLLED VERIFIER TEST - candidates injected by hand    *");
    console.log("  *  This is NOT scanner output; it is presented as such.      *");
    console.log("  *************************************************************");
  }
  const title = controlled ? "CodeProof controlled verifier test" : mock ? "CodeProof demo" : mode === "bench" ? "CodeProof benchmark run" : "CodeProof run";
  console.log(title + "  target=" + target);
  console.log("  run-id " + runId + (mock ? "  (mock)" : ""));

  const ingestStarted = Date.now();
  const repo = ingest(target);
  phases.push({ name: "ingest", status: "ok", durationMs: Date.now() - ingestStarted });
  console.log("  ingest   " + String(Date.now() - ingestStarted).padStart(4) + " ms  " +
    repo.files.length + " files, " + repo.loc + " LOC, " + repo.edges.length + " imports, " + repo.cycles.length + " cycles");

  const agents = createAgents({
    mock: mock,
    scenarioPath: join(target, "mock-scenario.json"),
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    scannerModel: config.scannerModel,
    verifierModel: config.verifierModel,
    maxRetries: config.maxRetries,
    budget: budget
  });

  let proposed;
  let scanValidated;
  let scanRaw;
  let rawCandidates;
  if (controlled) {
    scanRaw = readFileSync(resolve(args.candidates), "utf8");
    const candidateDoc = JSON.parse(scanRaw);
    scanValidated = validateFindingsL0(candidateDoc);
    if (!scanValidated.ok) throw new Error("candidate findings failed L0: " + scanValidated.errors.join("; "));
    rawCandidates = candidateDoc.findings;
    proposed = scanValidated.findings;
    phases.push({ name: "scan", status: "skipped", durationMs: 0 });
    console.log("  scan     skip  controlled verifier: " + proposed.length + " injected candidates");
  } else {
    const scanStarted = Date.now();
    const scanMessages = buildScannerMessages({ digest: repoDigest(repo), filesWithLineNumbers: filesWithLineNumbers(repo), maxFindings: config.maxFindings });
    let scanCall;
    try {
      scanCall = await agents.complete({
        role: "scanner",
        messages: scanMessages,
        responseFormat: buildScannerResponseFormat(config.maxFindings),
        temperature: config.temperature,
        maxTokens: config.scannerMaxTokens
      });
    } catch (scanError) {
      if (scanError.code === "CONTENT_FILTERED") {
        console.error("");
        console.error("ERROR: safety filter blocked the model response during scan");
        process.exitCode = 1;
        return;
      }
      throw scanError;
    }
    let scanParsed;
    try {
      scanParsed = parseDirtyJson(scanCall.text);
    } catch (parseError) {
      mkdirSync(join(process.cwd(), "reports"), { recursive: true });
      writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ error: parseError.message, maxTokens: config.scannerMaxTokens, finishReason: scanCall.finishReason, raw: scanCall.text }, null, 2) + "\n");
      console.warn("  WARN scanner output was not valid JSON (" + parseError.message + ", finish_reason=" + String(scanCall.finishReason) + "); retrying once with " + (config.scannerMaxTokens * 2) + " max tokens");
      scanCall = await agents.complete({
        role: "scanner",
        messages: scanMessages,
        responseFormat: buildScannerResponseFormat(config.maxFindings),
        temperature: config.temperature,
        maxTokens: config.scannerMaxTokens * 2
      });
      try {
        scanParsed = parseDirtyJson(scanCall.text);
      } catch (retryParseError) {
        writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ error: retryParseError.message, maxTokens: config.scannerMaxTokens * 2, finishReason: scanCall.finishReason, raw: scanCall.text }, null, 2) + "\n");
        throw retryParseError;
      }
    }
    scanRaw = scanCall.text;
    scanValidated = validateFindingsL0(scanParsed);
    if (!scanValidated.ok) {
      mkdirSync(join(process.cwd(), "reports"), { recursive: true });
      writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ raw: scanCall.text, errors: scanValidated.errors }, null, 2) + "\n");
      throw new Error("scanner output failed L0: " + scanValidated.errors.join("; ") + " (raw output saved to reports/last-scan-raw.json)");
    }
    if (scanValidated.rejected.length > 0) {
      mkdirSync(join(process.cwd(), "reports"), { recursive: true });
      writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ raw: scanCall.text, rejected: scanValidated.rejected }, null, 2) + "\n");
    }
    rawCandidates = scanParsed.findings;
    proposed = scanValidated.findings;
    phases.push({ name: "scan", status: "ok", durationMs: Date.now() - scanStarted });
    console.log("  scan     " + String(Date.now() - scanStarted).padStart(4) + " ms  " +
      proposed.length + " proposed (input " + scanCall.usage.inputTokens + " tok, cached " + scanCall.usage.cachedTokens + ")");
  }

  const rejectedByIndex = new Map(scanValidated.rejected.map(function (item) { return [item.index, item]; }));
  const candidateAudit = rawCandidates.map(function (candidate, index) {
    const rejection = rejectedByIndex.get(index);
    return {
      index: index,
      candidate: candidate,
      l0: { ok: !rejection, reasons: rejection ? rejection.reasons : [] },
      status: rejection ? "l0-rejected" : "pending"
    };
  });
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const repoForGate = { root: target, manifest: manifest, commit: commit };
  const verifyStarted = Date.now();
  const published = [];
  let l1Rejected = 0;
  let aborted = false;
  let safetyFilterHit = false;
  let skippedFindings = [];
  function skipFrom(index) {
    aborted = true;
    skippedFindings = proposed.slice(index).map(function (finding) { return finding.id; });
    for (let remaining = index; remaining < proposed.length; remaining++) {
      candidateAudit[scanValidated.acceptedIndices[remaining]].status = "skipped-budget";
    }
  }
  if (budget.exceeded) skipFrom(0);
  for (let index = 0; index < proposed.length && !aborted; index++) {
    const finding = proposed[index];
    const verifierContext = buildVerifierContext({ repo: repo, finding: finding, maxChars: config.verifierContextChars });
    let outcome;
    try {
      outcome = await verifyOne({ finding: finding, repo: repoForGate, agent: agents, excerpts: verifierContext.text, maxTokens: config.verifierMaxTokens });
    } catch (error) {
      if (error.code === "BUDGET_EXCEEDED") {
        skipFrom(index);
        break;
      }
      if (error.code === "CONTENT_FILTERED") {
        console.warn("  WARN safety filter blocked the model response for " + finding.id);
        safetyFilterHit = true;
        outcome = {
          finding: finding,
          status: "uncertain",
          l1: { passed: true, reason: "citation verified against the commit" },
          verifier: {
            model: config.verifierModel,
            verdict: "uncertain",
            reason: "safety filter blocked the model response (finish_reason=content_filter)"
          }
        };
      } else {
        throw error;
      }
    }
    const audit = candidateAudit[scanValidated.acceptedIndices[index]];
    audit.status = outcome.status;
    audit.l1 = outcome.l1;
    if (outcome.verifier) audit.verifier = outcome.verifier;
    if (outcome.status === "l1-rejected") {
      l1Rejected += 1;
    } else {
      published.push({
        finding: outcome.finding,
        status: outcome.status,
        l1: { passed: true, reason: outcome.l1.reason, lineTolerance: outcome.l1.lineTolerance === undefined ? 0 : outcome.l1.lineTolerance },
        verifier: outcome.verifier
      });
    }
    if (budget.exceeded) skipFrom(index + 1);
  }
  phases.push({ name: "verify", status: aborted ? "aborted" : "ok", durationMs: Date.now() - verifyStarted });
  const counts = {
    proposed: proposed.length,
    l0Rejected: { count: scanValidated.rejected.length, items: scanValidated.rejected },
    l1Rejected: l1Rejected,
    verified: published.filter(function (item) { return item.status === "verified"; }).length,
    moderate: published.filter(function (item) { return item.status === "moderate"; }).length,
    refuted: published.filter(function (item) { return item.status === "refuted"; }).length,
    uncertain: published.filter(function (item) { return item.status === "uncertain"; }).length
  };
  console.log("  verify   " + String(Date.now() - verifyStarted).padStart(4) + " ms  " +
    counts.verified + " verified, " + counts.refuted + " refuted, " + counts.moderate + " moderate, " +
    counts.uncertain + " uncertain, " + counts.l1Rejected + " rejected at L1");

  const publishStarted = Date.now();
  let outDir = resolve(args.out, runId);
  if (existsSync(outDir)) {
    let suffix = 2;
    while (existsSync(outDir + "-" + suffix)) suffix += 1;
    outDir = outDir + "-" + suffix;
  }
  mkdirSync(outDir, { recursive: true });
  const outLabel = args.out + "/" + outDir.slice(resolve(args.out).length + 1);
  const byRoleMap = new Map();
  for (const call of agents.callLog) {
    const role = call.role === "scanner" ? "scanner-correctness" : "verifier";
    if (!byRoleMap.has(role)) {
      byRoleMap.set(role, { role: role, model: call.model, calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: mock ? null : 0 });
    }
    const aggregate = byRoleMap.get(role);
    aggregate.calls += 1;
    aggregate.inputTokens += call.inputTokens;
    aggregate.outputTokens += call.outputTokens;
    aggregate.cachedTokens += call.cachedTokens;
    if (!mock && call.costUsd !== null) aggregate.costUsd += call.costUsd;
  }
  const totalInput = agents.callLog.reduce(function (sum, call) { return sum + call.inputTokens; }, 0);
  const totalOutput = agents.callLog.reduce(function (sum, call) { return sum + call.outputTokens; }, 0);
  const totalCached = agents.callLog.reduce(function (sum, call) { return sum + call.cachedTokens; }, 0);
  const measured = !mock && agents.callLog.every(function (call) { return call.costUsd !== null; });
  const totalCost = measured ? agents.callLog.reduce(function (sum, call) { return sum + (call.costUsd || 0); }, 0) : null;
  const runJson = {
    runId: runId,
    mode: mode,
    mock: mock,
    configSha256: configSha256,
    repo: { source: "local", path: target, commit: commit, dirty: dirty, loc: repo.loc, files: repo.files.length },
    models: mock
      ? [{ role: "scanner-correctness", id: "mock-scanner" }, { role: "verifier", id: "mock-verifier" }]
      : controlled
        ? [{ role: "verifier", id: config.verifierModel }]
        : [{ role: "scanner-correctness", id: config.scannerModel }, { role: "verifier", id: config.verifierModel }],
    prompts: prompts,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cachedTokens: totalCached,
      byRole: Array.from(byRoleMap.values()),
      callLog: agents.callLog,
      costUsd: aborted ? budget.spentUsd : totalCost,
      measured: measured
    },
    calls: agents.callLog.length,
    retries: agents.callLog.reduce(function (sum, call) { return sum + (call.retries || 0); }, 0),
    timings: { startedAt: startedAt, durationMs: Date.now() - startedAtMs },
    phases: phases,
    budget: {
      limitUsd: config.budgetUsd,
      spentUsd: aborted ? budget.spentUsd : (measured ? Math.round(budget.spentUsd * 1e6) / 1e6 : null),
      measured: measured,
      exceeded: budget.exceeded,
      aborted: aborted,
      skippedFindings: skippedFindings
    },
    findings: counts,
    outputs: {
      report: outLabel + "/REPORT.md",
      findings: outLabel + "/findings.json",
      rejected: outLabel + "/rejected.md"
    },
    versions: { node: process.version, codeproof: VERSION }
  };
  writeFileSync(join(outDir, "REPORT.md"), buildReport({ repo: repo, published: published, run: runJson }) + "\n");
  writeFileSync(join(outDir, "rejected.md"), buildRejected({ published: published, run: runJson }) + "\n");
  writeFileSync(join(outDir, "findings.json"), JSON.stringify(published, null, 2) + "\n");
  writeFileSync(join(outDir, "candidates.json"), JSON.stringify({ raw: scanRaw, candidates: candidateAudit }, null, 2) + "\n");
  phases.push({ name: "publish", status: "ok", durationMs: Date.now() - publishStarted });
  runJson.timings.durationMs = Date.now() - startedAtMs;
  writeFileSync(join(outDir, "run.json"), JSON.stringify(runJson, null, 2) + "\n");
  console.log("  publish  " + String(Date.now() - publishStarted).padStart(4) + " ms  " + outDir);
  console.log("");
  console.log("  Report:   " + join(outDir, "REPORT.md"));
  console.log("  Rejected: " + join(outDir, "rejected.md"));
  console.log("  Findings: " + join(outDir, "findings.json"));
  console.log("  Run:      " + join(outDir, "run.json"));
  console.log("  Cost:     " + (measured ? "$" + totalCost.toFixed(4) : "not measured (mock)"));
  console.log("  Cache:    " + totalCached + " of " + totalInput + " input tokens served from cache");
  console.log("");
  if (aborted) {
    console.error("ERROR: run budget exceeded: spent " + budget.spentUsd + " USD of " + budget.limitUsd);
    process.exitCode = 1;
  } else if (safetyFilterHit) {
    console.error("ERROR: safety filter blocked the model response on one or more findings");
    process.exitCode = 1;
  }
}

main().catch(function (error) {
  console.error("");
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});
