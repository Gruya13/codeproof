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
    scannerMaxTokens: Number(env.SCANNER_MAX_TOKENS || "10000"),
    verifierMaxTokens: Number(env.VERIFIER_MAX_TOKENS || "4000"),
    verifierContextChars: Number(env.VERIFIER_CONTEXT_CHARS || "24000")
  };
}

export function costOf(model, usage) {
  const price = PRICES[model];
  if (!price) return null;
  const cached = Math.min(usage.cachedTokens || 0, usage.inputTokens || 0);
  const uncached = Math.max(0, (usage.inputTokens || 0) - cached);
  return (uncached * price.input + cached * price.cachedInput + (usage.outputTokens || 0) * price.output) / 1e6;
}