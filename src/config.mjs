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

export const VERSION = "0.1.0";

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
    secondaryScannerModel: env.SECONDARY_SCANNER_MODEL || env.VERIFIER_MODEL || "muse-wonder-1.0"
  };
}

export function computeConfigSha256(config, mode) {
  const payload = JSON.stringify({
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
    secondaryScannerModel: config.secondaryScannerModel
  });
  return createHash("sha256").update(payload).digest("hex");
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
