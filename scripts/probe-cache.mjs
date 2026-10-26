#!/usr/bin/env node
// Prompt-cache TTL probe.
// Sends one large, identical prefix to the Meta Model API at controlled intervals
// and records usage.cached_tokens for every call. Two independent series run in
// parallel; they differ in the system prompt, so their cache prefixes do not
// overlap:
//   series A (continuous): warmup t=0, measure at +2, +5, +10 min
//   series B (isolated):   warmup t=0, measure at +10 min (no refresh in between)
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

function sleep(ms) {
  return new Promise(function (resolveSleep) { setTimeout(resolveSleep, ms); });
}

function parseArgs(argv) {
  const options = {
    scope: "reports/probes/real/axios-lib/_repo/lib",
    minutes: "2,5,10",
    isolatedMinute: 10,
    out: null,
    capUsd: Number(process.env.CACHE_PROBE_CAP_USD || "0.5")
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--scope") options.scope = take();
    else if (arg === "--minutes") options.minutes = take();
    else if (arg === "--isolated-minute") options.isolatedMinute = Number(take());
    else if (arg === "--out") options.out = take();
    else if (arg === "--cap-usd") options.capUsd = Number(take());
    else if (arg === "--help" || arg === "-h") { console.log("usage: node scripts/probe-cache.mjs [--scope <dir>] [--minutes 2,5,10] [--isolated-minute 10] [--out <dir>] [--cap-usd 0.5]"); process.exit(0); }
    else throw new Error("unknown option: " + arg);
  }
  return options;
}

async function main() {
  loadDotEnv(resolve(".env"));
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.MODEL_API_KEY || "";
  if (!apiKey) throw new Error("MODEL_API_KEY is required for the cache probe");
  const baseUrl = process.env.META_BASE_URL || "https://api.meta.ai/v1";
  const model = process.env.CACHE_PROBE_MODEL || "muse-spark-1.3-contributor";
  const scope = resolve(options.scope);
  const repo = ingest(scope);
  const prefix = filesWithLineNumbers(repo);
  const minutes = options.minutes.split(",").map(Number).filter(function (value) { return Number.isFinite(value) && value > 0; });
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outDir = options.out ? resolve(options.out) : resolve("reports/probes/cache-ttl", stamp);
  mkdirSync(outDir, { recursive: true });
  const complete = createMetaAgent({ apiKey: apiKey, baseUrl: baseUrl, model: model, maxRetries: 2 });
  let spentUsd = 0;
  const calls = [];

  async function call(series, label) {
    if (spentUsd >= options.capUsd) {
      console.log("  cap reached ($" + spentUsd.toFixed(4) + " >= $" + options.capUsd + "), skipping " + series + " " + label);
      return null;
    }
    const messages = [
      { role: "system", content: "You are a prompt-cache probe (" + series + "). Reply with OK." },
      { role: "user", content: prefix + "\n\nReply with exactly: OK" }
    ];
    const requestedAt = Date.now();
    const result = await complete({ messages: messages, maxTokens: 4, temperature: 0 });
    const cost = costOf(model, result.usage);
    if (typeof cost === "number") spentUsd += cost;
    const entry = {
      series: series,
      label: label,
      requestedAt: new Date(requestedAt).toISOString(),
      elapsedSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cachedTokens,
      uncachedTokens: result.usage.inputTokens - result.usage.cachedTokens,
      costUsd: typeof cost === "number" ? Math.round(cost * 1e6) / 1e6 : null,
      latencyMs: result.latencyMs,
      retries: result.retries,
      finishReason: result.finishReason,
      text: String(result.text || "").slice(0, 40)
    };
    calls.push(entry);
    console.log("  " + series + " " + label + "  t+" + entry.elapsedSec + "s  in " + entry.inputTokens +
      "  cached " + entry.cachedTokens + "  out " + entry.outputTokens + "  cost $" + entry.costUsd);
    return entry;
  }

  function elapsedMs() {
    return Date.now() - startedAt.getTime();
  }

  async function waitUntilMinute(minute) {
    const target = minute * 60 * 1000;
    const remaining = target - elapsedMs();
    if (remaining > 0) await sleep(remaining);
  }

  console.log("Cache TTL probe");
  console.log("  model    " + model);
  console.log("  scope    " + scope + " (" + repo.files.length + " files)");
  console.log("  prefix   " + prefix.length + " chars, ~" + Math.round(prefix.length / 3.6) + " tokens");
  console.log("  minutes  " + minutes.join(", ") + " (continuous A) + " + options.isolatedMinute + " (isolated B)");
  console.log("  cap      $" + options.capUsd);
  console.log("");

  const warmA = call("A", "warmup");
  const warmB = call("B", "warmup");
  await Promise.all([warmA, warmB]);
  const continuous = [];
  for (const minute of minutes) {
    await waitUntilMinute(minute);
    continuous.push(await call("A", "t+" + minute + "min"));
  }
  await waitUntilMinute(options.isolatedMinute);
  const isolated = await call("B", "t+" + options.isolatedMinute + "min (isolated)");

  const byLabel = function (label) {
    for (const entry of calls) if (entry.label === label) return entry;
    return null;
  };
  const verdict = [];
  for (const minute of minutes) {
    const entry = byLabel("t+" + minute + "min");
    if (entry) verdict.push({ intervalMin: minute, cachedTokens: entry.cachedTokens, alive: entry.cachedTokens > 0 });
  }
  if (isolated) verdict.push({ intervalMin: options.isolatedMinute, cachedTokens: isolated.cachedTokens, alive: isolated.cachedTokens > 0, isolated: true, warmupCached: byLabel("warmup") ? null : null });
  const payload = {
    tool: "probe-cache",
    createdAt: startedAt.toISOString(),
    model: model,
    scope: scope,
    files: repo.files.length,
    prefixChars: prefix.length,
    estimatedPrefixTokens: Math.round(prefix.length / 3.6),
    minutes: minutes,
    isolatedMinute: options.isolatedMinute,
    capUsd: options.capUsd,
    spentUsd: Math.round(spentUsd * 1e6) / 1e6,
    calls: calls,
    verdict: verdict,
    note: "cached_tokens > 0 means the API reused the prefix cache on that call. The isolated series measures the cache after no refresh; the continuous series measures it while the prefix keeps being used. A zero may also mean the request landed on a different backend instance, so this probe reports lower bounds, not an exact TTL."
  };
  writeFileSync(join(outDir, "results.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log("");
  console.log("  verdict:");
  for (const item of verdict) console.log("    " + (item.isolated ? "isolated " : "continual ") + "t+" + item.intervalMin + "min  cached " + item.cachedTokens + "  -> " + (item.alive ? "ALIVE" : "miss"));
  console.log("  spent    $" + payload.spentUsd);
  console.log("  results  " + join(outDir, "results.json"));
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});
