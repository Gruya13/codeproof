#!/usr/bin/env node
// Parallel-call probe:
//   A4  - fire N small calls at once; record 429/5xx retry behaviour per call
//   A4b - warm one large prefix, then fire 3 concurrent calls with the same
//         prefix and record cached_tokens per call (does the cache help under
//         concurrency?)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMetaAgent } from "../src/agents/meta.mjs";
import { costOf } from "../src/config.mjs";
import { ingest, filesWithLineNumbers } from "../src/ingest/index.mjs";

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

async function main() {
  loadDotEnv(resolve(".env"));
  const apiKey = process.env.MODEL_API_KEY || "";
  if (!apiKey) throw new Error("MODEL_API_KEY is required for the parallel probe");
  const baseUrl = process.env.META_BASE_URL || "https://api.meta.ai/v1";
  const model = process.env.PARALLEL_PROBE_MODEL || "muse-spark-1.3-contributor";
  const prefixScope = resolve(process.env.PARALLEL_PROBE_SCOPE || "reports/probes/real/axios-lib/_repo/lib");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve("reports/probes/parallel", stamp);
  mkdirSync(outDir, { recursive: true });
  const complete = createMetaAgent({ apiKey: apiKey, baseUrl: baseUrl, model: model, maxRetries: 4 });
  let spentUsd = 0;
  const record = function (kind, index, result, error) {
    const usage = result ? result.usage : { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
    const cost = result ? costOf(model, usage) : 0;
    spentUsd += cost || 0;
    return {
      kind: kind,
      index: index,
      ok: !error,
      error: error ? error.message : null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      costUsd: Math.round((cost || 0) * 1e6) / 1e6,
      retries: result ? result.retries : null,
      latencyMs: result ? result.latencyMs : null,
      finishReason: result ? result.finishReason : null
    };
  };

  // A4: concurrent small calls
  let smallCalls = [];
  if (process.env.PARALLEL_SMALL !== "0") {
    const tasks = [];
    for (let i = 0; i < 6; i += 1) {
      tasks.push((async function (index) {
        try {
          const result = await complete({
            messages: [{ role: "user", content: "Reply with exactly: OK" }],
            maxTokens: 8,
            temperature: 0
          });
          return record("small", index, result, null);
        } catch (error) {
          return record("small", index, null, error);
        }
      })(i));
    }
    smallCalls = await Promise.all(tasks);
  }

  // A4b: concurrent calls with one shared large prefix
  let prefixCalls = [];
  let prefixChars = 0;
  let warmup = null;
  if (process.env.PARALLEL_PREFIX !== "0" && existsSync(prefixScope)) {
    const repo = ingest(prefixScope);
    const prefix = filesWithLineNumbers(repo);
    prefixChars = prefix.length;
    const messages = [
      { role: "system", content: "You are a parallel cache probe. Reply with OK." },
      { role: "user", content: prefix + "\n\nReply with exactly: OK" }
    ];
    try {
      warmup = record("prefix-warmup", 0, await complete({ messages: messages, maxTokens: 4, temperature: 0 }), null);
    } catch (error) {
      warmup = record("prefix-warmup", 0, null, error);
    }
    const tasks = [];
    for (let i = 0; i < 3; i += 1) {
      tasks.push((async function (index) {
        try {
          return record("prefix-concurrent", index, await complete({ messages: messages, maxTokens: 4, temperature: 0 }), null);
        } catch (error) {
          return record("prefix-concurrent", index, null, error);
        }
      })(i));
    }
    prefixCalls = await Promise.all(tasks);
  }

  const calls = smallCalls.concat(warmup ? [warmup] : []).concat(prefixCalls);
  const payload = {
    tool: "probe-parallel",
    createdAt: new Date().toISOString(),
    model: model,
    prefixScope: prefixScope,
    prefixChars: prefixChars,
    estimatedPrefixTokens: Math.round(prefixChars / 3.6),
    calls: calls,
    summary: {
      smallCallsOk: smallCalls.filter(function (call) { return call.ok; }).length,
      smallCallsTotal: smallCalls.length,
      smallCallsRetries: smallCalls.reduce(function (sum, call) { return sum + (call.retries || 0); }, 0),
      smallCallsErrors: smallCalls.filter(function (call) { return !call.ok; }).map(function (call) { return call.error; }),
      prefixCached: prefixCalls.map(function (call) { return call.cachedTokens; }),
      prefixWarmupCached: warmup ? warmup.cachedTokens : null,
      spentUsd: Math.round(spentUsd * 1e6) / 1e6
    },
    note: "Small concurrent calls measure retry behaviour under load (429/5xx are retried by the adapter). The prefix group measures whether a shared prompt prefix is served from cache when the calls are concurrent."
  };
  writeFileSync(join(outDir, "results.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log("Parallel probe");
  console.log("  model       " + model);
  console.log("  small       " + payload.summary.smallCallsOk + "/" + payload.summary.smallCallsTotal + " ok, retries " + payload.summary.smallCallsRetries);
  if (payload.summary.smallCallsErrors.length) console.log("  errors      " + payload.summary.smallCallsErrors.join(" | "));
  console.log("  prefix      " + prefixChars + " chars, warmup cached " + payload.summary.prefixWarmupCached + ", concurrent cached " + JSON.stringify(payload.summary.prefixCached));
  console.log("  spent       $" + payload.summary.spentUsd);
  console.log("  results     " + join(outDir, "results.json"));
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});
