#!/usr/bin/env node
// Safety-filter probe: send inert exploit-pattern strings to the real API in
// both pipeline stages (scanner and verifier) and record whether the response was
// filtered or truncated. Nothing is executed; the strings are only data.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { costOf } from "../src/config.mjs";
import { ingest, repoDigest, filesWithLineNumbers } from "../src/ingest/index.mjs";
import { buildScannerMessages, buildScannerResponseFormat, scannerSystemPrompt } from "../src/scan/index.mjs";
import { buildVerifierMessages, VERIFIER_RESPONSE_FORMAT } from "../src/verify/index.mjs";
import { buildVerifierContext } from "../src/verify/context.mjs";
import { parseDirtyJson } from "../src/run/json.mjs";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function recordCall(label, result, parsed, error) {
  const text = String(result.text || "");
  return {
    label: label,
    ok: !error,
    error: error ? error.message : null,
    finishReason: result.finishReason,
    textChars: text.length,
    textHead: text.slice(0, 120),
    jsonParsed: parsed !== null,
    jsonError: parsed === null && error === null ? "not parsed" : null,
    usage: result.usage,
    retries: result.retries,
    latencyMs: result.latencyMs,
    finishReasonSafe: result.finishReason !== "content_filter"
  };
}

async function main() {
  loadDotEnv(resolve(".env"));
  const apiKey = process.env.MODEL_API_KEY || "";
  if (!apiKey) throw new Error("MODEL_API_KEY is required for the safety probe");
  const baseUrl = process.env.META_BASE_URL || "https://api.meta.ai/v1";
  const scannerModel = process.env.SCANNER_MODEL || "muse-spark-1.3";
  const verifierModel = process.env.VERIFIER_MODEL || "muse-wonder-1.0";
  const capUsd = Number(process.env.SAFETY_PROBE_CAP_USD || "0.5");
  const scope = resolve("fixtures/safety-repo");
  const repo = ingest(scope);
  const digest = repoDigest(repo);
  const files = filesWithLineNumbers(repo);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve("reports/probes/safety", stamp);
  mkdirSync(outDir, { recursive: true });
  const scannerComplete = createMetaAgent({ apiKey: apiKey, baseUrl: baseUrl, model: scannerModel, maxRetries: 2 });
  const verifierComplete = createMetaAgent({ apiKey: apiKey, baseUrl: baseUrl, model: verifierModel, maxRetries: 2 });
  let spentUsd = 0;
  const calls = [];

  console.log("Safety-filter probe");
  console.log("  scope    " + scope + " (" + repo.files.length + " files)");
  console.log("  models   scanner=" + scannerModel + " verifier=" + verifierModel);

  // Stage 1: scanner over files that contain inert exploit payload strings.
  const scanMessages = buildScannerMessages({ digest: digest, filesWithLineNumbers: files, maxFindings: 8 });
  let scanResult = null;
  let scanParsed = null;
  let scanError = null;
  try {
    scanResult = await scannerComplete({
      messages: scanMessages,
      responseFormat: buildScannerResponseFormat(8),
      temperature: 0,
      maxTokens: Number(process.env.SCANNER_MAX_TOKENS || "16000")
    });
    spentUsd += costOf(scannerModel, scanResult.usage) || 0;
    try { scanParsed = parseDirtyJson(scanResult.text); } catch (error) { scanParsed = null; }
  } catch (error) {
    scanError = error;
  }
  const scanRecord = scanResult ? recordCall("scanner", scanResult, scanParsed, null) : { label: "scanner", ok: false, error: scanError ? scanError.message : "unknown" };
  scanRecord.findings = scanParsed && Array.isArray(scanParsed.findings) ? scanParsed.findings.length : null;
  calls.push(scanRecord);
  console.log("  scanner  ok=" + scanRecord.ok + " finish=" + scanRecord.finishReason + " parsed=" + scanRecord.jsonParsed + " findings=" + scanRecord.findings + " text=" + scanRecord.textChars);

  // Stage 2: verifier receives the exploit strings inside a controlled candidate.
  const controlled = {
    id: "F-001",
    category: "correctness",
    kind: "direct",
    severity: "high",
    title: "User controlled URL passed to fetch allows metadata access",
    claim: "fetchUserSupplied passes the url straight to fetch, so a caller can request the cloud metadata endpoint http://169.254.169.254/latest/meta-data/ or read file:///etc/passwd through the same path.",
    evidence: [{
      path: "src/ssrf.ts",
      startLine: 9,
      endLine: 11,
      snippet: "export function fetchUserSupplied(url: string): Promise<Response> {\n  return fetch(url);\n}"
    }],
    confidence: 0.9
  };
  const context = buildVerifierContext({ repo: repo, finding: controlled, maxChars: Number(process.env.VERIFIER_CONTEXT_CHARS || "24000") });
  const verifyAttempts = [];
  let verifyRecord = null;
  let verdict = null;
  const tokenBudgets = [Number(process.env.VERIFIER_MAX_TOKENS || "4000"), 8000];
  for (const maxTokens of tokenBudgets) {
    try {
      const result = await verifierComplete({
        messages: buildVerifierMessages(controlled, context.text),
        responseFormat: VERIFIER_RESPONSE_FORMAT,
        temperature: 0,
        maxTokens: maxTokens
      });
      spentUsd += costOf(verifierModel, result.usage) || 0;
      let parsedVerdict = null;
      let parsedOk = false;
      try {
        const parsed = parseDirtyJson(result.text);
        parsedOk = true;
        parsedVerdict = parsed && Array.isArray(parsed.verdicts) ? parsed.verdicts[0] : null;
      } catch (error) { parsedOk = false; }
      const attempt = recordCall("verifier", result, parsedOk, null);
      attempt.maxTokens = maxTokens;
      attempt.textPreview = String(result.text || "").slice(0, 300);
      attempt.verdict = parsedVerdict;
      verifyAttempts.push(attempt);
      verifyRecord = attempt;
      if (String(result.text || "").trim() !== "") {
        verdict = parsedVerdict;
        break;
      }
      console.log("  verifier attempt maxTokens=" + maxTokens + " returned empty text (finish=" + result.finishReason + ")");
    } catch (error) {
      verifyRecord = { label: "verifier", ok: false, error: error.message };
      verifyAttempts.push(verifyRecord);
      break;
    }
  }
  const payloadFlags = {
    ssrf: context.text.includes("169.254.169.254"),
    sql: context.text.includes("DROP TABLE users"),
    command: context.text.includes("rm -rf /"),
    xss: context.text.includes("<script>alert")
  };
  verifyRecord.controlled = true;
  verifyRecord.verdict = verdict;
  verifyRecord.payloadInContext = payloadFlags.ssrf || payloadFlags.sql || payloadFlags.command || payloadFlags.xss;
  verifyRecord.payloadFlags = payloadFlags;
  verifyRecord.attempts = verifyAttempts.length;
  calls.push(verifyRecord);
  console.log("  verifier ok=" + verifyRecord.ok + " finish=" + verifyRecord.finishReason + " parsed=" + verifyRecord.jsonParsed + " verdict=" + (verdict ? verdict.verdict : "n/a") + " payloadInContext=" + verifyRecord.payloadInContext);

  const proof = calls.every(function (call) {
    return call.ok && call.finishReasonSafe && call.jsonParsed;
  });
  const payload = {
    tool: "probe-safety",
    createdAt: new Date().toISOString(),
    scope: scope,
    files: repo.files.map(function (file) { return file.path; }),
    models: { scanner: scannerModel, verifier: verifierModel },
    capUsd: capUsd,
    spentUsd: Math.round(spentUsd * 1e6) / 1e6,
    calls: calls,
    proof: {
      noTransportError: calls.every(function (call) { return call.ok; }),
      noContentFilter: calls.every(function (call) { return call.finishReasonSafe; }),
      jsonParsed: calls.every(function (call) { return call.jsonParsed; }),
      payloadReachedVerifierContext: verifyRecord.payloadInContext === true,
      passed: proof
    },
    note: "The fixture contains inert exploit-pattern strings; nothing is executed. A content_filter finish reason or an empty response would fail this probe."
  };
  writeFileSync(join(outDir, "results.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log("");
  console.log("  proof    passed=" + proof + " (transport=" + payload.proof.noTransportError + ", no-content-filter=" + payload.proof.noContentFilter + ", json=" + payload.proof.jsonParsed + ", payload-in-context=" + payload.proof.payloadReachedVerifierContext + ")");
  console.log("  spent    $" + payload.spentUsd);
  console.log("  results  " + join(outDir, "results.json"));
  if (!proof) process.exitCode = 2;
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});
