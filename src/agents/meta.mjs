import { costOf } from "../config.mjs";

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function backoffMs(attempt) {
  const base = Math.min(30000, 500 * Math.pow(2, attempt - 1));
  return base + Math.floor(Math.random() * 250);
}

function mapUsage(usage) {
  const input = usage && typeof usage.prompt_tokens === "number"
    ? usage.prompt_tokens
    : (usage && usage.input_tokens) || 0;
  const output = usage && typeof usage.completion_tokens === "number"
    ? usage.completion_tokens
    : (usage && usage.output_tokens) || 0;
  const details = usage && (usage.prompt_tokens_details || usage.input_tokens_details);
  const cached = details && typeof details.cached_tokens === "number" ? details.cached_tokens : 0;
  return { inputTokens: input, outputTokens: output, cachedTokens: cached };
}

export function createMetaAgent(options) {
  const apiKey = options.apiKey;
  const baseUrl = options.baseUrl;
  const model = options.model;
  const maxRetries = options.maxRetries === undefined ? 4 : options.maxRetries;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  return async function complete(request) {
    if (!apiKey) throw new Error("MODEL_API_KEY is required for a real (non-mock) run");
    const body = {
      model: model,
      messages: request.messages,
      temperature: request.temperature === undefined ? 0 : request.temperature
    };
    if (request.responseFormat) body.response_format = request.responseFormat;
    if (request.maxTokens) body.max_tokens = request.maxTokens;
    let attempt = 0;
    let lastError = null;
    const startedAt = Date.now();
    while (attempt <= maxRetries) {
      let response;
      try {
        response = await fetchImpl(baseUrl + "/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey
          },
          body: JSON.stringify(body)
        });
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt <= maxRetries) await sleep(backoffMs(attempt));
        continue;
      }
      if (response.ok) {
        const json = await response.json();
        const choice = json.choices && json.choices[0];
        const text = choice && choice.message ? choice.message.content : "";
        const usage = mapUsage(json.usage);
        return {
          text: text,
          usage: usage,
          costUsd: costOf(model, usage),
          model: model,
          latencyMs: Date.now() - startedAt,
          retries: attempt
        };
      }
      const status = response.status;
      const retryable = status === 429 || status >= 500;
      const errorText = await response.text().catch(function () { return ""; });
      lastError = new Error("Meta Model API HTTP " + status + ": " + errorText.slice(0, 300));
      if (!retryable) throw lastError;
      attempt += 1;
      const retryAfter = Number(response.headers.get("retry-after") || "0");
      if (attempt <= maxRetries) {
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
      }
    }
    throw lastError || new Error("Meta Model API call failed");
  };
}
