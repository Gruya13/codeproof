#!/usr/bin/env node
// Real-world probe harness: clone a pinned repository, measure the scope that
// enters the scanner prompt, then run the real pipeline and record metrics.
// Nothing from the analyzed repository is executed; it is only read.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ingest, filesWithLineNumbers, repoDigest } from "../src/ingest/index.mjs";
import { gitCommit, repoIsClean } from "../src/run/index.mjs";

const MAX_PROMPT_CHARS = 400000;

function parseArgs(argv) {
  const options = {
    repo: null, commit: null, scope: ".", runs: 1, mode: "smoke",
    out: null, workdir: null, maxFindings: 12, dryRun: false, tag: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--repo") options.repo = take();
    else if (arg === "--commit") options.commit = take();
    else if (arg === "--scope") options.scope = take();
    else if (arg === "--runs") options.runs = Number(take());
    else if (arg === "--mode") options.mode = take();
    else if (arg === "--out") options.out = take();
    else if (arg === "--workdir") options.workdir = take();
    else if (arg === "--max-findings") options.maxFindings = Number(take());
    else if (arg === "--tag") options.tag = take();
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") { console.log(USAGE); process.exit(0); }
    else throw new Error("unknown option: " + arg);
  }
  if (!options.repo && !options.workdir) throw new Error("--repo <git-url> or --workdir <existing-clone> is required");
  return options;
}

const USAGE = [
  "usage: node scripts/probe-repo.mjs --repo <url> [--commit <sha>] [--scope <dir>] [options]",
  "",
  "  --repo <url>          public git repository to clone (read-only analysis)",
  "  --commit <sha>        pin a commit; default: tip of the default branch",
  "  --scope <dir>         directory inside the repo to analyze; default: .",
  "  --workdir <dir>       reuse an existing clone instead of cloning again",
  "  --runs <n>            number of pipeline runs; default: 1",
  "  --mode <demo|smoke>   CLI mode for the runs; default: smoke",
  "  --max-findings <n>    MAX_FINDINGS for the scanner; default: 12",
  "  --out <dir>           artifact directory; default: reports/probes/real/<tag>",
  "  --tag <name>          short name used in the default output path",
  "  --dry-run             only clone + measure scope/prompt; no API calls",
  "",
  "Exit codes: 0 ok, 1 error, 2 prompt would be truncated (scope does not fit)"
].join("\n");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd: cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 900000 });
  if (result.error) throw new Error(command + " " + args.join(" ") + " failed: " + result.error.message);
  return result;
}

function ensureClone(options) {
  if (options.workdir) {
    const dir = resolve(options.workdir);
    if (!existsSync(join(dir, ".git"))) throw new Error("--workdir is not a git clone: " + dir);
    if (options.commit) {
      const head = run("git", ["-C", dir, "rev-parse", "HEAD"]).stdout.trim();
      if (!head.startsWith(options.commit) && !options.commit.startsWith(head)) {
        const fetch = run("git", ["-C", dir, "fetch", "--depth", "1", "origin", options.commit]);
        if (fetch.status !== 0) throw new Error("cannot fetch commit " + options.commit);
        const checkout = run("git", ["-C", dir, "checkout", "--detach", options.commit]);
        if (checkout.status !== 0) throw new Error("cannot checkout commit " + options.commit);
      }
    }
    return dir;
  }
  const base = options.out ? resolve(options.out) : resolve("reports/probes/real", options.tag || "repo");
  const dir = join(base, "_repo");
  if (existsSync(join(dir, ".git"))) {
    run("git", ["-C", dir, "fetch", "--depth", "1", "origin"]);
    run("git", ["-C", dir, "checkout", "--detach", "origin/HEAD"]);
  } else {
    mkdirSync(base, { recursive: true });
    const clone = run("git", ["clone", "--depth", "1", options.repo, dir]);
    if (clone.status !== 0) throw new Error("git clone failed: " + clone.stderr);
  }
  if (options.commit) {
    const checkout = run("git", ["-C", dir, "fetch", "--depth", "1", "origin", options.commit]);
    if (checkout.status !== 0) throw new Error("cannot fetch commit " + options.commit);
    const detach = run("git", ["-C", dir, "checkout", "--detach", options.commit]);
    if (detach.status !== 0) throw new Error("cannot checkout commit " + options.commit);
  }
  return dir;
}

function nextRunDirs(outDir) {
  if (!existsSync(outDir)) return new Set();
  return new Set(readdirSync(outDir, { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cloneDir = ensureClone(options);
  const scopeAbs = resolve(cloneDir, options.scope);
  if (!existsSync(scopeAbs)) throw new Error("scope does not exist: " + scopeAbs);
  const commit = run("git", ["-C", cloneDir, "rev-parse", "HEAD"]).stdout.trim();
  const clean = await repoIsClean(scopeAbs);
  const repo = ingest(scopeAbs);
  const digest = repoDigest(repo);
  const prompt = filesWithLineNumbers(repo);
  const includedFiles = (prompt.match(/^### /gm) || []).length;
  const promptComplete = includedFiles === repo.files.length;
  const stats = {
    repo: options.repo || cloneDir,
    commit: commit,
    scope: options.scope,
    scopePath: scopeAbs,
    clean: clean,
    files: repo.files.length,
    loc: repo.loc,
    importEdges: repo.edges.length,
    cycles: repo.cycles.length,
    digestChars: digest.length,
    promptChars: prompt.length,
    promptFiles: includedFiles,
    promptComplete: promptComplete,
    promptCap: MAX_PROMPT_CHARS,
    estimatedInputTokens: Math.round(prompt.length / 3.6)
  };
  const outDir = options.out ? resolve(options.out) : resolve("reports/probes/real", options.tag || "repo");
  mkdirSync(outDir, { recursive: true });

  console.log("Real-world probe");
  console.log("  repo     " + stats.repo);
  console.log("  commit   " + commit + (clean ? " (clean)" : " (DIRTY)"));
  console.log("  scope    " + options.scope + " -> " + scopeAbs);
  console.log("  scope    " + repo.files.length + " files, " + repo.loc + " LOC, " + repo.edges.length + " imports, " + repo.cycles.length + " cycles");
  console.log("  digest   " + digest.length + " chars");
  console.log("  prompt   " + prompt.length + " chars, " + includedFiles + "/" + repo.files.length + " files, ~" + stats.estimatedInputTokens + " tokens");
  if (!promptComplete) {
    console.log("  WARN     prompt is TRUNCATED at the " + MAX_PROMPT_CHARS + "-char cap: " + (repo.files.length - includedFiles) + " files are not sent");
  }
  if (!clean) console.log("  WARN     working tree is dirty; L1 will read from the commit anyway, but the scope is not reproducible");

  if (options.dryRun) {
    stats.dryRun = true;
    writeFileSync(join(outDir, "scope.json"), JSON.stringify(stats, null, 2) + "\n");
    console.log("  dry-run  scope written to " + join(outDir, "scope.json"));
    console.log("  RESULT   " + (promptComplete ? "scope fits into the scanner prompt" : "scope does NOT fit - choose a smaller scope"));
    process.exitCode = promptComplete ? 0 : 2;
    return;
  }

  const runs = [];
  const totalBefore = budgetSpentBefore(outDir);
  for (let index = 0; index < options.runs; index += 1) {
    const before = nextRunDirs(outDir);
    const startedAt = Date.now();
    const result = run(process.execPath, ["src/cli.mjs", "analyze", scopeAbs, "--mode", options.mode, "--out", outDir], process.cwd());
    const elapsedMs = Date.now() - startedAt;
    const created = readdirSync(outDir, { withFileTypes: true })
      .filter(function (e) { return e.isDirectory() && !before.has(e.name); })
      .map(function (e) { return e.name; });
    if (created.length === 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      throw new Error("run " + (index + 1) + " produced no run directory (exit " + result.status + ")");
    }
    const runDirName = created.sort().pop();
    const runDir = join(outDir, runDirName);
    const runJson = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
    let candidates = null;
    try { candidates = JSON.parse(readFileSync(join(runDir, "candidates.json"), "utf8")); } catch (error) { candidates = null; }
    let l1PassRate = null;
    let l1Checked = 0;
    if (candidates && Array.isArray(candidates.candidates)) {
      const l0Ok = candidates.candidates.filter(function (item) { return item.l0 && item.l0.ok; });
      const l1Ok = l0Ok.filter(function (item) { return item.l1 && item.l1.passed; });
      l1Checked = l0Ok.length;
      l1PassRate = l0Ok.length > 0 ? l1Ok.length / l0Ok.length : null;
    }
    const entry = {
      index: index + 1,
      runId: runJson.runId,
      runDir: runDir,
      exitCode: result.status,
      elapsedMs: elapsedMs,
      mode: runJson.mode,
      mock: runJson.mock,
      repo: runJson.repo,
      usage: {
        inputTokens: runJson.usage.inputTokens,
        outputTokens: runJson.usage.outputTokens,
        cachedTokens: runJson.usage.cachedTokens,
        byRole: runJson.usage.byRole
      },
      costUsd: runJson.usage.costUsd,
      measured: runJson.usage.measured,
      calls: runJson.calls,
      retries: runJson.retries,
      budget: runJson.budget,
      findings: runJson.findings,
      l1PassRate: l1PassRate,
      l1Checked: l1Checked,
      phases: runJson.phases,
      durationMs: runJson.timings.durationMs
    };
    runs.push(entry);
    console.log("");
    console.log("  run " + entry.index + "  id " + entry.runId + "  exit " + entry.exitCode);
    console.log("        " + entry.repo.loc + " LOC / " + entry.repo.files + " files, " + entry.calls + " calls, " + entry.retries + " retries");
    console.log("        tokens in/out/cached  " + entry.usage.inputTokens + " / " + entry.usage.outputTokens + " / " + entry.usage.cachedTokens);
    console.log("        findings  proposed " + entry.findings.proposed + ", verified " + entry.findings.verified +
      ", moderate " + entry.findings.moderate + ", refuted " + entry.findings.refuted +
      ", uncertain " + entry.findings.uncertain + ", L1-rejected " + entry.findings.l1Rejected +
      ", L0-rejected " + (entry.findings.l0Rejected && entry.findings.l0Rejected.count !== undefined ? entry.findings.l0Rejected.count : 0));
    console.log("        L1 pass rate  " + (l1PassRate === null ? "n/a" : Math.round(l1PassRate * 1000) / 10 + "%") + " (" + l1Checked + " checked)");
    console.log("        cost  " + (entry.measured ? "$" + Number(entry.costUsd).toFixed(4) : "not measured") + "  duration " + Math.round(entry.durationMs / 1000) + " s");
  }
  const totalCost = runs.reduce(function (sum, entry) { return sum + (entry.measured ? Number(entry.costUsd) || 0 : 0); }, 0);
  const probe = {
    tool: "probe-repo",
    createdAt: new Date().toISOString(),
    stats: stats,
    runs: runs,
    summary: {
      runs: runs.length,
      totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
      costBeforeUsd: totalBefore,
      avgL1PassRate: average(runs.map(function (entry) { return entry.l1PassRate; })),
      verified: sum(runs, "verified"),
      moderate: sum(runs, "moderate"),
      refuted: sum(runs, "refuted"),
      uncertain: sum(runs, "uncertain"),
      l1Rejected: sum(runs, "l1Rejected"),
      promptComplete: promptComplete
    }
  };
  writeFileSync(join(outDir, "probe.json"), JSON.stringify(probe, null, 2) + "\n");
  console.log("");
  console.log("  probe    " + join(outDir, "probe.json"));
  console.log("  total    $" + probe.summary.totalCostUsd + " for " + runs.length + " run(s)");
  if (!promptComplete) process.exitCode = 2;
}

function sum(runs, key) {
  return runs.reduce(function (acc, entry) { return acc + (entry.findings && Number(entry.findings[key]) ? Number(entry.findings[key]) : 0); }, 0);
}

function average(values) {
  const numbers = values.filter(function (value) { return typeof value === "number"; });
  if (numbers.length === 0) return null;
  return Math.round((numbers.reduce(function (a, b) { return a + b; }, 0) / numbers.length) * 1000) / 1000;
}

function budgetSpentBefore(outDir) {
  let total = 0;
  if (!existsSync(outDir)) return 0;
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    try {
      const run = JSON.parse(readFileSync(join(outDir, entry.name, "run.json"), "utf8"));
      if (run.usage && typeof run.usage.costUsd === "number") total += run.usage.costUsd;
    } catch (error) { continue; }
  }
  return Math.round(total * 1e6) / 1e6;
}

main().catch(function (error) {
  console.error("ERROR: " + error.message);
  process.exitCode = 1;
});
