import { createHash } from "node:crypto";

export const PRICES = {
  "muse-spark-1.3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.2": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.1": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.3-contributor": { input: 0.1, cachedInput: 0.002, output: 0.2 },
  "muse-spark-1.2-contributor": { input: 0.1, cachedInput: 0.002, output: 0.2 },
  "muse-wonder-1.0": { input: 4, cachedInput: 0.2, output: 20 }
};

export const LIMITS = { citationMaxLines: 15, maxFindings: 8 };

export const VERSION = "0.2.2";

export function loadConfig(env) {
  return {
    baseUrl: env.META_BASE_URL || "https://api.meta.ai/v1",
    scannerModel: env.SCANNER_MODEL || "muse-spark-1.3",
    verifierModel: env.VERIFIER_MODEL || "muse-wonder-1.0",
    temperature: 0,
    maxFindings: Number(env.MAX_FINDINGS || String(LIMITS.maxFindings)),
    citationMaxLines: LIMITS.citationMaxLines,
    budgetUsd: Number(env.BUDGET_USD || "2"),
    mock: env.USE_MOCK === "1",
    apiKey: env.MODEL_API_KEY || "",
    maxRetries: Number(env.MAX_RETRIES || "4"),
    scannerMaxTokens: Number(env.SCANNER_MAX_TOKENS || "16000"),
    verifierMaxTokens: Number(env.VERIFIER_MAX_TOKENS || "4000"),
    verifierContextChars: Number(env.VERIFIER_CONTEXT_CHARS || "24000"),
    reproEnabled: env.USE_MOCK !== "1" && env.REPRO !== "0",
    reproModel: env.REPRO_MODEL || env.VERIFIER_MODEL || "muse-wonder-1.0",
    reproMaxTokens: Number(env.REPRO_MAX_TOKENS || "8000"),
    reproTimeoutMs: Number(env.REPRO_TIMEOUT_MS || "2000"),
    reproAttempts: Number(env.REPRO_ATTEMPTS || "3"),
    hardBudget: env.HARD_BUDGET !== "0",
    dualScan: env.DUAL_SCAN === "1",
    // Chunked scanning: slice the repository by top-level directory and scan each slice with the
    // same prompt. Measured on the extended set: scanner recall 50% -> 68.8% for ~2x the scan cost.
    chunkedScan: env.CHUNKED_SCAN === "1",
    secondaryScannerModel: env.SECONDARY_SCANNER_MODEL || env.VERIFIER_MODEL || "muse-wonder-1.0",
    // The secondary scanner (Wonder) only finishes on small targets; above this LOC the second
    // scan is skipped. 0 disables the guard (explicit opt-in for experiments).
    dualScanMaxLoc: Number(env.DUAL_SCAN_MAX_LOC || "0"),
    // v0.2.0: L4 patch stage. The patch model is the existing verifier model (no new prices) and
    // every patch call goes through the same hard-budget preflight as any other call.
    patchEnabled: env.PATCH !== "0",
    patchModel: env.PATCH_MODEL || env.VERIFIER_MODEL || "muse-wonder-1.0",
    patchMaxTokens: Number(env.PATCH_MAX_TOKENS || "6000"),
    patchMaxCandidates: Number(env.PATCH_MAX_CANDIDATES || "3"),
    // v0.2.0: L2 escalation is opt-in and out of the mandatory scope.
    verifyEscalate: env.VERIFY_ESCALATE === "1",
    // v0.2.0: the mock adapter runs the real local L3/L4 executions (no network).
    mockPipeline: env.MOCK_PIPELINE === "1" || (env.MOCK_PIPELINE !== "0" && env.USE_MOCK === "1")
  };
}

// The config payload that the run identity hashes. Version 1 is byte-identical to the pre-v0.2.0
// payload, so every existing v1 hash stays valid. Version 2 appends the v0.2.0 fields additively.
export function configPayload(config, mode, options) {
  const version = options && options.version === 2 ? 2 : 1;
  const payload = {
    mode: mode,
    scannerModel: config.scannerModel,
    verifierModel: config.verifierModel,
    temperature: config.temperature,
    maxFindings: config.maxFindings,
    citationMaxLines: config.citationMaxLines,
    scannerMaxTokens: config.scannerMaxTokens,
    verifierMaxTokens: config.verifierMaxTokens,
    verifierContextChars: config.verifierContextChars,
    reproEnabled: config.reproEnabled,
    reproModel: config.reproModel,
    reproMaxTokens: config.reproMaxTokens,
    reproTimeoutMs: config.reproTimeoutMs,
    reproAttempts: config.reproAttempts,
    hardBudget: config.hardBudget,
    dualScan: config.dualScan,
    chunkedScan: config.chunkedScan,
    secondaryScannerModel: config.secondaryScannerModel,
    dualScanMaxLoc: config.dualScanMaxLoc
  };
  if (version === 2) {
    payload.patchEnabled = config.patchEnabled;
    payload.patchModel = config.patchModel;
    payload.patchMaxTokens = config.patchMaxTokens;
    payload.patchMaxCandidates = config.patchMaxCandidates;
    payload.verifyEscalate = config.verifyEscalate;
    payload.mockPipeline = config.mockPipeline;
  }
  return payload;
}

export function computeConfigSha256(config, mode, options) {
  return createHash("sha256").update(JSON.stringify(configPayload(config, mode, options))).digest("hex");
}

// The hash of a payload that a v2 run stored verbatim in run.json.config.payload.
export function configPayloadSha256(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// Worst-case cost of one call: no cache hits and the full max_tokens output budget.
// Used by the hard budget gate before a request is sent.
export function estimateCost(model, inputTokens, outputTokens) {
  const price = PRICES[model];
  if (!price) return null; // unknown price: the caller must fail closed, never assume zero
  return ((inputTokens || 0) * price.input + (outputTokens || 0) * price.output) / 1e6;
}

export function costOf(model, usage) {
  const price = PRICES[model];
  if (!price) return null;
  const cached = Math.min(usage.cachedTokens || 0, usage.inputTokens || 0);
  const uncached = Math.max(0, (usage.inputTokens || 0) - cached);
  return (uncached * price.input + cached * price.cachedInput + (usage.outputTokens || 0) * price.output) / 1e6;
}
