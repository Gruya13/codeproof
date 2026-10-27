import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(function (key) {
    return JSON.stringify(key) + ":" + stableJson(value[key]);
  }).join(",") + "}";
}

export function computeRunId(input) {
  const digest = sha256Hex(stableJson({
    commit: input.commit,
    configSha256: input.configSha256,
    models: input.models,
    prompts: input.prompts
  }));
  return digest.slice(0, 16);
}

export function gitCommit(dir) {
  return new Promise(function (resolve) {
    execFile("git", ["-C", dir, "rev-parse", "HEAD"], function (error, stdout) {
      if (error) return resolve("0000000");
      resolve(stdout.trim());
    });
  });
}

const gitPrefixCache = new Map();

export function gitPrefix(target) {
  if (gitPrefixCache.has(target)) return gitPrefixCache.get(target);
  try {
    const prefix = execFileSync("git", ["-C", target, "rev-parse", "--show-prefix"], { encoding: "utf8" }).trim();
    gitPrefixCache.set(target, prefix);
    return prefix;
  } catch (error) {
    gitPrefixCache.set(target, null);
    return null;
  }
}

export function readFileAtCommit(target, commit, relativePath) {
  if (!commit || commit === "0000000") return null;
  const prefix = gitPrefix(target);
  if (prefix === null) return null;
  const gitPath = (prefix + relativePath).replace(/\/{2,}/g, "/");
  try {
    return execFileSync("git", ["-C", target, "show", commit + ":" + gitPath], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    return null;
  }
}

export function repoIsClean(target) {
  return new Promise(function (resolve) {
    execFile("git", ["-C", target, "status", "--porcelain", "--", "."], function (statusError, statusStdout) {
      if (statusError) return resolve(false);
      if (String(statusStdout).trim() !== "") return resolve(false);
      execFile("git", ["-C", target, "diff", "--quiet", "HEAD", "--", "."], function (diffError) {
        resolve(!diffError);
      });
    });
  });
}

export class Budget {
  constructor(limitUsd) {
    this.limitUsd = limitUsd;
    this.spentUsd = 0;
    this.calls = 0;
    this.exceeded = false;
  }
  // The hard gate calls this before a request is sent, with a worst-case estimate.
  canAfford(estimatedCostUsd) {
    // An unmeasurable call cannot be allowed: a zero estimate would silently disable the cap.
    if (estimatedCostUsd === null || estimatedCostUsd === undefined || !Number.isFinite(estimatedCostUsd)) return false;
    return this.spentUsd + estimatedCostUsd <= this.limitUsd + 1e-9;
  }
  charge(costUsd) {
    this.calls += 1;
    if (costUsd === null || costUsd === undefined) return;
    this.spentUsd += costUsd;
    if (this.spentUsd > this.limitUsd + 1e-9) this.exceeded = true;
  }
}
