import { createHash } from "node:crypto";
import { execFile } from "node:child_process";

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

export class Budget {
  constructor(limitUsd) {
    this.limitUsd = limitUsd;
    this.spentUsd = 0;
    this.calls = 0;
    this.exceeded = false;
  }
  charge(costUsd) {
    this.calls += 1;
    if (costUsd === null || costUsd === undefined) return;
    this.spentUsd += costUsd;
    if (this.spentUsd > this.limitUsd) this.exceeded = true;
  }
}
