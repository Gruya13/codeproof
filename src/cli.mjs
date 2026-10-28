#!/usr/bin/env node
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, computeConfigSha256, configPayload, VERSION } from "./config.mjs";
import { ingest, repoDigest, buildScannerInput, filesWithLineNumbers } from "./ingest/index.mjs";
import { buildAttestation } from "./run/attest.mjs";
import { prepareSnapshot } from "./repro/index.mjs";
import { attemptPatch, writePatchArtifacts } from "./patch/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, scannerSystemPrompt, validateFindingsL0 } from "./scan/index.mjs";
import { mergeScannerRuns } from "./scan/merge.mjs";
import { verifyOne, VERIFIER_SYSTEM_PROMPT } from "./verify/index.mjs";
import { buildVerifierContext } from "./verify/context.mjs";
import { buildReport, buildRejected } from "./synthesize/index.mjs";
import { parseDirtyJson } from "./run/json.mjs";
import { computeRunId, sha256Hex, gitCommit, repoIsClean, Budget } from "./run/index.mjs";
import { createAgents, aggregateUsage } from "./agents/index.mjs";
import { attemptRepro, writeReproArtifacts } from "./repro/index.mjs";

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

export function evidenceLevelFor(status, patch, repro) {
  if (status !== "verified") return null;
  if (patch && patch.status === "patch-proven") return "patch-proven";
  if (repro && repro.status === "reproduced" && repro.linkcheck && repro.linkcheck.status === "proven") return "execution-proven";
  return "citation+adversarial";
}

export function buildRunBanner(options) {
  const lines = [];
  if (options.mock) {
    lines.push("  *************************************************************");
    lines.push("  *  MOCK MODE - synthetic output, no network, no model calls  *");
    lines.push("  *************************************************************");
  }
  if (options.controlled) {
    lines.push("  *************************************************************");
    lines.push("  *  CONTROLLED VERIFIER TEST - candidates injected by hand    *");
    lines.push("  *  This is NOT scanner output; it is NOT presented as such.  *");
    lines.push("  *************************************************************");
  }
  const title = options.controlled ? "CodeProof controlled verifier test" : options.mock ? "CodeProof demo" : options.mode === "bench" ? "CodeProof benchmark run" : "CodeProof run";
  lines.push(title + "  target=" + options.target);
  lines.push("  mode " + (options.mock ? "mock" : options.mode));
  if (!options.mock) lines.push("  models scanner=" + (options.controlled ? "skipped" : options.scannerModel) + " verifier=" + options.verifierModel + " repro=" + (options.reproEnabled ? options.reproModel : "off"));
  if (options.dualScan) lines.push("  dual-scan secondary scanner=" + options.secondaryScannerModel + " (cross-verification: each finding is checked by the other model)");
  if (options.chunkedScan) lines.push("  chunked scan: one focused scanner call per top-level directory, candidates limited to their slice");
  lines.push("  run-id " + options.runId + (options.mock ? "  (mock)" : ""));
  return lines.join("\n");
}

// F3: offline replay command. No model calls, no API key; exit 0 only when every replayed
// mechanical check matches the recorded report.
async function mainReplay(argv) {
  const options = { reportDir: null, repoPath: null, anchor: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--anchor") { options.anchor = argv[index + 1]; index += 1; }
    else if (token === "--out") { options.out = argv[index + 1]; index += 1; }
    else if (token === "--repo") { options.repoPath = argv[index + 1]; index += 1; }
    else if (!options.reportDir) options.reportDir = token;
    else if (!options.repoPath) options.repoPath = token;
    else throw new Error("unexpected argument: " + token);
  }
  if (!options.reportDir) {
    console.log("usage: node src/cli.mjs replay <report-dir> [repo-path] [--anchor <rev>] [--out <dir>]");
    process.exitCode = 2;
    return;
  }
  const replay = await import("./run/replay.mjs");
  const result = await replay.replayRun(options);
  const text = replay.formatReplay(result);
  console.log(text);
  if (options.out) {
    const outDir = resolve(options.out);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "replay.json"), JSON.stringify(result, null, 2) + "\n");
    writeFileSync(join(outDir, "REPLAY.md"), text + "\n");
    console.log("");
    console.log("  written  " + outDir);
  }
  if (!result.matches) process.exitCode = 1;
}

async function main() {
  if (process.argv[2] === "replay" || process.argv[2] === "--replay") {
    return mainReplay(process.argv.slice(3));
  }
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
  // v0.2.0: the run identity is the version-2 payload; v1 hashes stay valid for old artifacts.
  const configSha256 = computeConfigSha256(config, mode, { version: 2 });
  const configPayloadV2 = configPayload(config, mode, { version: 2 });
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
  console.log(buildRunBanner({ mock: mock, controlled: controlled, mode: mode, target: target, runId: runId,
    scannerModel: config.scannerModel, verifierModel: config.verifierModel,
    reproModel: config.reproModel, reproEnabled: config.reproEnabled && !controlled,
    dualScan: config.dualScan && !controlled, secondaryScannerModel: config.secondaryScannerModel,
    chunkedScan: config.chunkedScan && !controlled }));

  const ingestStarted = Date.now();
  const repo = ingest(target, { commit: commit });
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
    reproModel: config.reproModel,
    patchModel: config.patchModel,
    secondaryScannerModel: config.secondaryScannerModel,
    secondaryVerifierModel: config.scannerModel,
    maxRetries: config.maxRetries,
    hardBudget: config.hardBudget,
    budget: budget
  });

  let proposed = [];
  let proposedEntries = [];
  let scanRuns = [];
  let scanRaw = null;
  let rawCandidates = [];
  const scanStarted = Date.now();
  const scannerInput = controlled ? null : buildScannerInput(repo);
  if (scannerInput && scannerInput.truncated) {
    console.warn("  WARN scanner input truncated: " + scannerInput.filesInPrompt + " of " + scannerInput.filesTotal + " files (" + scannerInput.chars + " of " + scannerInput.cap + " chars) fit into the prompt; findings can only come from the included files");
  }
  const scanMessages = controlled ? null : buildScannerMessages({ digest: repoDigest(repo), filesWithLineNumbers: scannerInput.text, maxFindings: config.maxFindings });
  const scanFormat = controlled ? null : buildScannerResponseFormat(config.maxFindings);

  // One scanner pass: call, parse, tolerate one truncation retry, validate at L0.
  // `messages`/`format` are passed in so the same routine serves the single-pass scan, the
  // secondary scanner and every chunk of a chunked scan. `pathFilter` drops candidates that cite
  // files outside the scanned slice (the model cannot see them, so they are out of scope).
  async function runScanner(role, label, messages, format, options) {
    const started = Date.now();
    const pathFilter = options && options.pathFilter ? options.pathFilter : null;
    const filteredOutIds = new Set();
    try {
      let call = await agents.complete({ role: role, messages: messages, responseFormat: format, temperature: config.temperature, maxTokens: config.scannerMaxTokens });
      let parsed;
      try {
        parsed = parseDirtyJson(call.text);
      } catch (parseError) {
        mkdirSync(join(process.cwd(), "reports"), { recursive: true });
        writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ scanner: label, error: parseError.message, maxTokens: config.scannerMaxTokens, finishReason: call.finishReason, raw: call.text }, null, 2) + "\n");
        console.warn("  WARN " + label + " scanner output was not valid JSON (" + parseError.message + ", finish_reason=" + String(call.finishReason) + "); retrying once with " + (config.scannerMaxTokens * 2) + " max tokens");
        call = await agents.complete({ role: role, messages: messages, responseFormat: format, temperature: config.temperature, maxTokens: config.scannerMaxTokens * 2 });
        try {
          parsed = parseDirtyJson(call.text);
        } catch (retryParseError) {
          writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ scanner: label, error: retryParseError.message, maxTokens: config.scannerMaxTokens * 2, finishReason: call.finishReason, raw: call.text }, null, 2) + "\n");
          throw retryParseError;
        }
      }
      const validated = validateFindingsL0(parsed);
      if (validated.ok && pathFilter) {
        const inScope = validated.findings.filter(function (finding) {
          return finding.evidence.every(function (evidence) { return pathFilter.has(evidence.path); });
        });
        for (const finding of validated.findings) {
          if (inScope.indexOf(finding) === -1) filteredOutIds.add(finding.id);
        }
        validated.findings = inScope;
      }
      if (!validated.ok) {
        mkdirSync(join(process.cwd(), "reports"), { recursive: true });
        writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ scanner: label, raw: call.text, errors: validated.errors }, null, 2) + "\n");
      } else if (validated.rejected.length > 0) {
        mkdirSync(join(process.cwd(), "reports"), { recursive: true });
        writeFileSync(join(process.cwd(), "reports", "last-scan-raw.json"), JSON.stringify({ scanner: label, raw: call.text, rejected: validated.rejected }, null, 2) + "\n");
      }
      return { role: role, proposedBy: label, status: validated.ok ? "ok" : "l0-invalid", raw: call.text, parsed: parsed, validated: validated, call: call, durationMs: Date.now() - started, filteredOutIds: filteredOutIds, group: (options && options.group) || null };
    } catch (error) {
      return { role: role, proposedBy: label, status: "error", code: error.code || null, error: error.message, durationMs: Date.now() - started, filteredOutIds: filteredOutIds, group: (options && options.group) || null };
    }
  }

  if (controlled) {
    scanRaw = readFileSync(resolve(args.candidates), "utf8");
    const candidateDoc = JSON.parse(scanRaw);
    const controlledValidated = validateFindingsL0(candidateDoc);
    if (!controlledValidated.ok) throw new Error("candidate findings failed L0: " + controlledValidated.errors.join("; "));
    scanRuns = [{ role: "controlled", proposedBy: "controlled", status: "ok", raw: scanRaw, parsed: candidateDoc, validated: controlledValidated, call: null, durationMs: 0 }];
    phases.push({ name: "scan", status: "skipped", durationMs: 0 });
    console.log("  scan     skip  controlled verifier: " + controlledValidated.findings.length + " injected candidates");
  } else if (config.chunkedScan) {
    // Chunked scan: one focused scanner call per top-level directory. The same model and prompt
    // are used for every slice; a candidate that cites a file outside its slice is out of scope.
    const groups = new Map();
    for (const file of repo.files) {
      const parts = file.path.split("/");
      const key = parts.length > 1 ? parts[0] : "(root)";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    }
    const groupNames = Array.from(groups.keys()).sort();
    let chunkFiles = 0;
    let chunkLoc = 0;
    for (const name of groupNames) {
      const files = groups.get(name);
      const fileSet = new Set(files.map(function (file) { return file.path; }));
      const chunkRepo = {
        root: repo.root, sources: repo.sources, commit: repo.commit, files: files,
        loc: files.reduce(function (sum, file) { return sum + file.loc; }, 0),
        edges: repo.edges.filter(function (edge) { return fileSet.has(edge.from) && fileSet.has(edge.to); }),
        cycles: repo.cycles.filter(function (cycle) { return cycle.every(function (path) { return fileSet.has(path); }); })
      };
      const chunkInput = buildScannerInput(chunkRepo);
      chunkFiles += chunkInput.filesInPrompt;
      chunkLoc += chunkRepo.loc;
      const chunkMessages = buildScannerMessages({ digest: repoDigest(chunkRepo), filesWithLineNumbers: chunkInput.text, maxFindings: config.maxFindings });
      const chunkFormat = buildScannerResponseFormat(config.maxFindings);
      const chunkRun = await runScanner("scanner", "spark", chunkMessages, chunkFormat, { pathFilter: fileSet, group: name });
      chunkRun.coverage = { filesInPrompt: chunkInput.filesInPrompt, filesTotal: chunkInput.filesTotal, chars: chunkInput.chars, cap: chunkInput.cap, truncated: chunkInput.truncated };
      scanRuns.push(chunkRun);
      if (chunkRun.status !== "ok") {
        console.warn("  WARN chunk " + name + " failed: " + (chunkRun.error || (chunkRun.validated ? chunkRun.validated.errors.join("; ") : "unknown")) + "; continuing with the other chunks");
      }
    }
    scanRaw = JSON.stringify({ chunked: true, groups: scanRuns.map(function (run) { return { group: run.group, raw: run.raw }; }) }, null, 2);
    phases.push({ name: "scan", status: "ok", durationMs: Date.now() - scanStarted });
  } else {
    const primary = await runScanner("scanner", "spark", scanMessages, scanFormat);
    if (primary.status !== "ok") {
      if (primary.code === "CONTENT_FILTERED") {
        console.error("");
        console.error("ERROR: safety filter blocked the model response during scan");
        process.exitCode = 1;
        return;
      }
      throw new Error("scanner failed: " + (primary.error || (primary.validated ? primary.validated.errors.join("; ") : "unknown")));
    }
    scanRuns.push(primary);
    scanRaw = primary.raw;
    if (config.dualScan) {
      const secondaryLabel = config.secondaryScannerModel === config.scannerModel ? "secondary" : "wonder";
      if (config.dualScanMaxLoc > 0 && repo.loc > config.dualScanMaxLoc) {
        const skipped = { role: "scanner-secondary", proposedBy: secondaryLabel, status: "skipped-loc", call: null, durationMs: 0, parsed: null, validated: null,
          reason: "repository has " + repo.loc + " LOC, above DUAL_SCAN_MAX_LOC=" + config.dualScanMaxLoc }
        scanRuns.push(skipped);
        console.warn("  WARN secondary scanner skipped: " + skipped.reason);
      } else {
        const secondary = await runScanner("scanner-secondary", secondaryLabel, scanMessages, scanFormat);
        scanRuns.push(secondary);
        if (secondary.status !== "ok") {
          console.warn("  WARN secondary scanner (" + config.secondaryScannerModel + ") failed: " + (secondary.error || (secondary.validated ? secondary.validated.errors.join("; ") : "unknown")) + "; continuing with the primary scanner only");
        }
      }
    }
    phases.push({ name: "scan", status: "ok", durationMs: Date.now() - scanStarted });
  }

  // Merge the scanners: duplicates collapse, fresh ids prevent collisions, every finding keeps its proposers.
  const mergeableRuns = scanRuns.filter(function (run) { return run.status === "ok"; }).map(function (run) {
    return { proposedBy: run.proposedBy, findings: run.validated.findings };
  });
  const mergeResult = mergeScannerRuns(mergeableRuns);
  proposedEntries = mergeResult.candidates;
  proposed = proposedEntries.map(function (entry) { return entry.finding; });

  // Audit: one record per raw candidate, so nothing is silently dropped.
  const candidateAudit = [];
  for (const run of scanRuns) {
    const rawFindings = run.parsed && Array.isArray(run.parsed.findings) ? run.parsed.findings : [];
    const rejectedByIndex = new Map((run.validated ? run.validated.rejected : []).map(function (item) { return [item.index, item]; }));
    run.validatedFindings = run.validated ? run.validated.findings : [];
    run.auditStart = candidateAudit.length;
    rawFindings.forEach(function (candidate, index) {
      const rejection = rejectedByIndex.get(index);
      const outOfScope = run.filteredOutIds && run.filteredOutIds.has(candidate.id);
      candidateAudit.push({
        index: candidateAudit.length,
        candidate: candidate,
        proposedBy: run.proposedBy,
        l0: { ok: !rejection, reasons: rejection ? rejection.reasons : [] },
        status: rejection ? "l0-rejected" : outOfScope ? "out-of-scope" : "pending"
      });
    });
  }
  rawCandidates = candidateAudit.map(function (item) { return item.candidate; });
  for (const entry of proposedEntries) {
    const auditItem = candidateAudit.find(function (item) {
      return item.proposedBy === entry.proposedBy[0] && item.candidate.id === entry.originalIds[0];
    });
    entry.auditIndex = auditItem ? auditItem.index : -1;
  }
  for (const duplicate of mergeResult.duplicates) {
    const auditItem = candidateAudit.find(function (item) {
      return item.proposedBy === duplicate.proposedBy && item.candidate.id === duplicate.originalId;
    });
    if (auditItem) auditItem.status = "duplicate-of " + duplicate.mergedInto;
  }
  const byScanner = {
    spark: proposedEntries.filter(function (entry) { return entry.proposedBy.indexOf("spark") !== -1; }).length,
    wonder: proposedEntries.filter(function (entry) { return entry.proposedBy.indexOf("wonder") !== -1; }).length,
    both: proposedEntries.filter(function (entry) { return entry.proposedBy.indexOf("spark") !== -1 && entry.proposedBy.indexOf("wonder") !== -1; }).length,
    controlled: proposedEntries.filter(function (entry) { return entry.proposedBy.indexOf("controlled") !== -1; }).length
  };
  if (!controlled) {
    console.log("  scan     " + String(Date.now() - scanStarted).padStart(4) + " ms  " +
      proposed.length + " unique proposed" +
      (config.dualScan ? " (spark " + byScanner.spark + " / wonder " + byScanner.wonder + " / both " + byScanner.both + ")" : "") +
      (config.chunkedScan ? " in " + scanRuns.length + " chunks" : "") +
      " (input " + String(scanRuns.reduce(function (sum, run) { return sum + (run.call ? run.call.usage.inputTokens : 0); }, 0)) + " tok)");
  }
  const manifest = new Map(repo.files.map(function (file) { return [file.path, file]; }));
  const repoForGate = { root: target, manifest: manifest, commit: commit };
  const verifyStarted = Date.now();
  const published = [];
  let l1Rejected = 0;
  let aborted = false;
  let abortReason = null;
  let safetyFilterHit = false;
  let skippedFindings = [];
  function skipFrom(index, reason) {
    aborted = true;
    if (reason && !abortReason) abortReason = reason;
    skippedFindings = proposedEntries.slice(index).map(function (entry) { return entry.finding.id; });
    for (let remaining = index; remaining < proposedEntries.length; remaining++) {
      const auditItem = candidateAudit[proposedEntries[remaining].auditIndex];
      if (auditItem) auditItem.status = "skipped-budget";
    }
  }
  if (budget.exceeded) skipFrom(0);
  for (let index = 0; index < proposedEntries.length && !aborted; index++) {
    const entry = proposedEntries[index];
    const finding = entry.finding;
    const verifierContext = buildVerifierContext({ repo: repo, finding: finding, maxChars: config.verifierContextChars });
    // Cross-examination by model: a finding proposed by the secondary scanner is verified by the
    // primary verifier model, and a finding proposed by the primary scanner by the secondary verifier.
    const crossVerifier = config.dualScan && entry.proposedBy.length === 1 && entry.proposedBy[0] === "wonder"
      ? { complete: function (request) { return agents.complete(Object.assign({}, request, { role: "verifier-secondary" })); } }
      : agents;
    let outcome;
    try {
      outcome = await verifyOne({ finding: finding, repo: repoForGate, agent: crossVerifier, excerpts: verifierContext.text, maxTokens: config.verifierMaxTokens });
    } catch (error) {
      if (error.code === "BUDGET_EXCEEDED") {
        skipFrom(index, error.message);
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
    const audit = candidateAudit[entry.auditIndex];
    if (audit) {
      audit.status = outcome.status;
      audit.l1 = outcome.l1;
      if (outcome.verifier) audit.verifier = outcome.verifier;
    }
    if (outcome.status === "l1-rejected") {
      l1Rejected += 1;
    } else {
      let repro = null;
      // L3 runs for real whenever it is enabled: live runs use the model adapter, and the mock
      // pipeline supplies canned control/trigger code that is executed locally (F1.9).
      const reproActive = config.mockPipeline || (!mock && config.reproEnabled);
      if (outcome.status === "verified" && reproActive && !controlled) {
        try {
          repro = await attemptRepro({
            finding: outcome.finding,
            agent: agents,
            repoRoot: target,
            commit: commit,
            excerpts: verifierContext.text,
            config: config,
            outDir: null
          });
        } catch (error) {
          if (error.code === "BUDGET_EXCEEDED") {
            skipFrom(index + 1, error.message);
            repro = { status: "inconclusive", classification: null, attempts: [], deterministic: false, testCode: "", expectedBehavior: "", rationale: "", reason: "budget gate refused the reproducer call: " + error.message };
          } else {
            repro = { status: "inconclusive", classification: null, attempts: [], deterministic: false, testCode: "", expectedBehavior: "", rationale: "", reason: "reproducer failed: " + error.message };
          }
        }
      }
      // L4 (F2): only an execution-proven finding with a valid linkage proof can be patched.
      let patch = null;
      const patchActive = config.patchEnabled && repro && repro.status === "reproduced" && repro.linkcheck && repro.linkcheck.status === "proven";
      if (patchActive) {
        let patchSnapshot = null;
        try {
          patchSnapshot = prepareSnapshot({ root: target, commit: commit, workDir: config.reproWorkDir });
          if (!patchSnapshot.available) {
            patch = { status: "unsupported", reason: patchSnapshot.reason };
          } else {
            patch = await attemptPatch({
              finding: outcome.finding,
              agent: agents,
              repoRoot: target,
              controlCode: repro.controlCode,
              testCode: repro.testCode,
              excerpts: verifierContext.text,
              snapshotDir: patchSnapshot.snapshotDir,
              config: config
            });
          }
        } catch (error) {
          if (error.code === "BUDGET_EXCEEDED") {
            skipFrom(index + 1, error.message);
            patch = { status: "unsupported", reason: "budget gate refused the patcher call: " + error.message };
          } else {
            patch = { status: "unsupported", reason: "patcher failed: " + error.message };
          }
        } finally {
          if (patchSnapshot && patchSnapshot.available) patchSnapshot.cleanup();
        }
      }
      published.push({
        finding: outcome.finding,
        status: outcome.status,
        proposedBy: entry.proposedBy,
        scannerIds: entry.originalIds,
        l1: { passed: true, reason: outcome.l1.reason, lineTolerance: outcome.l1.lineTolerance === undefined ? 0 : outcome.l1.lineTolerance },
        verifier: outcome.verifier,
        repro: repro,
        patch: patch,
        // patch-proven is the strongest level; execution-proven requires the two-phase run AND the
        // LinkCheck linkage proof (F1.10). A test that ran without the symbol executing is not a proof.
        evidenceLevel: evidenceLevelFor(outcome.status, patch, repro)
      });
    }
    if (budget.exceeded) skipFrom(index + 1);
  }
  phases.push({ name: "verify", status: aborted ? "aborted" : "ok", durationMs: Date.now() - verifyStarted });
  const l0RejectedItems = candidateAudit.filter(function (item) { return item.status === "l0-rejected"; });
  const counts = {
    proposed: proposed.length,
    byScanner: byScanner,
    duplicates: mergeResult.duplicates.length,
    l0Rejected: { count: l0RejectedItems.length, items: l0RejectedItems.map(function (item) {
      return { index: item.index, id: item.candidate ? item.candidate.id : undefined, reasons: item.l0.reasons, proposedBy: item.proposedBy };
    }) },
    l1Rejected: l1Rejected,
    verified: published.filter(function (item) { return item.status === "verified"; }).length,
    moderate: published.filter(function (item) { return item.status === "moderate"; }).length,
    refuted: published.filter(function (item) { return item.status === "refuted"; }).length,
    uncertain: published.filter(function (item) { return item.status === "uncertain"; }).length,
    reproduced: published.filter(function (item) { return item.repro && item.repro.status === "reproduced"; }).length,
    patched: published.filter(function (item) { return item.patch && item.patch.status === "patch-proven"; }).length
  };
  console.log("  verify   " + String(Date.now() - verifyStarted).padStart(4) + " ms  " +
    counts.verified + " verified, " + counts.refuted + " refuted, " + counts.moderate + " moderate, " +
    counts.uncertain + " uncertain, " + counts.l1Rejected + " rejected at L1, " + counts.reproduced + " reproduced" +
    (config.dualScan ? "  [byScanner: spark " + byScanner.spark + ", wonder " + byScanner.wonder + ", both " + byScanner.both + "]" : ""));

  const publishStarted = Date.now();
  let outDir = resolve(args.out, runId);
  if (existsSync(outDir)) {
    let suffix = 2;
    while (existsSync(outDir + "-" + suffix)) suffix += 1;
    outDir = outDir + "-" + suffix;
  }
  mkdirSync(outDir, { recursive: true });
  const outLabel = args.out + "/" + outDir.slice(resolve(args.out).length + 1);
  const byRole = aggregateUsage(agents.callLog, { mock: mock });
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
    configHashVersion: 2,
    config: { hashVersion: 2, payload: configPayloadV2 },
    repo: { source: repo.commit ? "commit" : "worktree", path: target, commit: commit, dirty: dirty, loc: repo.loc, files: repo.files.length },
    models: mock
      ? [{ role: "scanner-correctness", id: "mock-scanner" }, { role: "verifier", id: "mock-verifier" }].concat(config.mockPipeline ? [{ role: "repro", id: "mock-repro" }] : [])
      : controlled
        ? [{ role: "verifier", id: config.verifierModel }]
        : [{ role: "scanner-correctness", id: config.scannerModel }, { role: "verifier", id: config.verifierModel }]
            .concat(config.reproEnabled ? [{ role: "repro", id: config.reproModel }] : []),
    prompts: prompts,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cachedTokens: totalCached,
      byRole: byRole,
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
      hard: Boolean(config.hardBudget),
      aborted: aborted,
      abortReason: abortReason,
      skippedFindings: skippedFindings
    },
    findings: counts,
    scanCoverage: config.chunkedScan && !controlled ? (function () {
      const covered = scanRuns.filter(function (run) { return run.coverage; });
      return {
        chunked: true,
        groups: scanRuns.length,
        filesInPrompt: covered.reduce(function (sum, run) { return sum + run.coverage.filesInPrompt; }, 0),
        filesTotal: repo.files.length,
        chars: covered.reduce(function (sum, run) { return sum + run.coverage.chars; }, 0),
        truncated: covered.some(function (run) { return run.coverage.truncated; })
      };
    })() : scannerInput ? {
      filesInPrompt: scannerInput.filesInPrompt,
      filesTotal: scannerInput.filesTotal,
      chars: scannerInput.chars,
      cap: scannerInput.cap,
      truncated: scannerInput.truncated
    } : null,
    scanners: scanRuns.map(function (run) {
      return {
        role: run.role,
        proposedBy: run.proposedBy,
        model: run.call ? run.call.model : (run.proposedBy === "controlled" ? "injected" : null),
        status: run.status,
        candidates: run.validated ? run.validated.findings.length : 0,
        rejectedAtL0: run.validated ? run.validated.rejected.length : 0,
        costUsd: run.call && run.call.costUsd !== undefined ? run.call.costUsd : null,
        durationMs: run.durationMs,
        group: run.group || null,
        coverage: run.coverage || null,
        reason: run.reason || null
      };
    }),
    dualScan: Boolean(config.dualScan),
    chunkedScan: Boolean(config.chunkedScan),
    patch: { enabled: Boolean(config.patchEnabled), model: config.patchModel },
    repro: {
      enabled: Boolean(config.mockPipeline || (config.reproEnabled && !controlled && !mock)),
      model: config.reproModel,
      timeoutMs: config.reproTimeoutMs,
      attempts: config.reproAttempts,
      counts: {
        reproduced: counts.reproduced,
        notReproduced: published.filter(function (item) { return item.repro && item.repro.status === "not-reproduced"; }).length,
        unavailable: published.filter(function (item) { return item.repro && item.repro.status === "unavailable"; }).length,
        inconclusive: published.filter(function (item) { return item.repro && item.repro.status === "inconclusive"; }).length
      }
    },
    outputs: {
      report: outLabel + "/REPORT.md",
      findings: outLabel + "/findings.json",
      rejected: outLabel + "/rejected.md"
    },
    versions: { node: process.version, codeproof: VERSION }
  };
  writeFileSync(join(outDir, "REPORT.md"), buildReport({ repo: repo, repoRoot: target, published: published, run: runJson }) + "\n");
  writeFileSync(join(outDir, "rejected.md"), buildRejected({ published: published, candidates: candidateAudit, run: runJson }) + "\n");
  writeFileSync(join(outDir, "findings.json"), JSON.stringify(published, null, 2) + "\n");
  writeFileSync(join(outDir, "candidates.json"), JSON.stringify({ raw: scanRaw, candidates: candidateAudit }, null, 2) + "\n");
  for (const item of published) {
    if (item.repro) writeReproArtifacts(outDir, item.finding.id, item.repro);
    if (item.patch) writePatchArtifacts(outDir, item.finding.id, item.patch);
  }
  phases.push({ name: "publish", status: "ok", durationMs: Date.now() - publishStarted });
  runJson.timings.durationMs = Date.now() - startedAtMs;
  // v0.2.0 attestation: hashes of every committed artifact of this run (run.json excluded).
  runJson.attestation = buildAttestation(outDir);
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
    console.error("ERROR: run aborted by the budget gate: " + (abortReason || ("budget exceeded: spent " + budget.spentUsd + " USD of " + budget.limitUsd)));
    process.exitCode = 1;
  } else if (safetyFilterHit) {
    console.error("ERROR: safety filter blocked the model response on one or more findings");
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(function (error) {
    console.error("");
    console.error("ERROR: " + error.message);
    process.exitCode = 1;
  });
}
