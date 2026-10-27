import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDirtyJson } from "../run/json.mjs";
import { gitPrefix, readFileAtCommit } from "../run/index.mjs";

export const REPRO_SYSTEM_PROMPT = [
  "Write one standalone Node ESM test file for the finding. Import the real exported API from the repository using a path relative to its root, for example import { validate } from './src/validation.ts'. Node can import TypeScript directly.",
  "Assert the correct behavior with node:assert/strict so the test fails on the analyzed commit specifically because of the claim. Derive the expected behavior from the claim or a documented function contract; do not invent a new requirement.",
  "The test must be at most 60 lines. Use only node:assert/strict for assertions. Do not call assert.fail(), intercept process.exit, use require, make network calls (fetch, http, https, net), read files outside the repository, set a timeout longer than 1000 ms, or use infinite loops.",
  "If a faithful executable test needs a network, DOM, external file system, unavailable dependency, or environment not included in the repository, return kind unsupported with a specific reason instead of test code.",
  "Return only JSON matching the response schema. An unsupported response must have empty testCode."
].join("\n");

export const REPRO_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_reproducer",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["findingId", "kind", "testCode", "expectedBehavior", "rationale", "unsupportedReason"],
      properties: {
        findingId: { type: "string", pattern: "^F-[0-9]{3}$" },
        kind: { enum: ["test", "unsupported"] },
        testCode: { type: "string" },
        expectedBehavior: { type: "string" },
        rationale: { type: "string" },
        unsupportedReason: { type: "string" }
      }
    }
  }
};

const GUARD_CODE = [
  "import { syncBuiltinESMExports } from 'node:module';",
  "import net from 'node:net';",
  "import http from 'node:http';",
  "import https from 'node:https';",
  "import dns from 'node:dns';",
  "import tls from 'node:tls';",
  "import dgram from 'node:dgram';",
  "function blocked() { throw new Error('network disabled in repro sandbox'); }",
  "globalThis.fetch = blocked;",
  "net.Socket.prototype.connect = blocked; net.connect = blocked; net.createConnection = blocked;",
  "http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked;",
  "tls.connect = blocked; dgram.createSocket = blocked;",
  "for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'reverse']) { dns[name] = blocked; if (dns.promises) dns.promises[name] = blocked; }",
  "syncBuiltinESMExports();"
].join("\n") + "\n";

const FORBIDDEN_CODE = [
  [/\bassert\s*\.\s*fail\s*\(/i, "assert.fail"],
  [/\bprocess\s*\.\s*exit\b/i, "process.exit"],
  [/\brequire\s*\(/i, "require"],
  [/\bfetch\s*\(/i, "fetch"],
  [/https?:\/\//i, "URL"],
  [/node:(?:net|http|https|tls|dgram|child_process)\b/i, "network or child process module"],
  [/\bchild_process\b/i, "child process module"],
  [/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync)\s*\(/i, "file write"],
  [/\bsetTimeout\s*\([^,]+,\s*(?:[1-9]\d{3,}|[2-9]\d{2,})\s*\)/i, "long timeout"],
  [/\bconsole\s*\.\s*(?:error|warn|log|info|debug)\s*\(/i, "console output (it could mask the real failure class)"]
];

export function parseReproResponse(text) {
  return parseDirtyJson(text);
}

export function validateReproL0(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errors: ["response must be an object"], value: null };
  }
  const expectedKeys = REPRO_RESPONSE_FORMAT.json_schema.schema.required;
  for (const key of expectedKeys) {
    if (!(key in parsed)) errors.push("missing " + key);
  }
  for (const key of Object.keys(parsed)) {
    if (!expectedKeys.includes(key)) errors.push("unexpected " + key);
  }
  if (!/^F-[0-9]{3}$/.test(String(parsed.findingId || ""))) errors.push("invalid findingId");
  if (parsed.kind !== "test" && parsed.kind !== "unsupported") errors.push("invalid kind");
  for (const key of ["testCode", "expectedBehavior", "rationale", "unsupportedReason"]) {
    if (typeof parsed[key] !== "string") errors.push(key + " must be a string");
  }
  if (parsed.kind === "unsupported") {
    if (typeof parsed.testCode === "string" && parsed.testCode.trim() !== "") errors.push("unsupported response must not include testCode");
    if (typeof parsed.unsupportedReason === "string" && parsed.unsupportedReason.trim().length < 10) errors.push("unsupportedReason is too short");
  }
  if (parsed.kind === "test") {
    if (typeof parsed.testCode === "string") {
      if (parsed.testCode.trim() === "") errors.push("testCode is empty");
      if (parsed.testCode.split("\n").length > 60) errors.push("testCode exceeds 60 lines");
      if (!/node:assert(?:\/strict)?/.test(parsed.testCode)) errors.push("testCode must import node:assert");
      for (const [pattern, label] of FORBIDDEN_CODE) {
        if (pattern.test(parsed.testCode)) errors.push("forbidden " + label);
      }
    }
    if (typeof parsed.expectedBehavior === "string" && parsed.expectedBehavior.trim().length < 10) errors.push("expectedBehavior is too short");
    if (typeof parsed.rationale === "string" && parsed.rationale.trim().length < 10) errors.push("rationale is too short");
  }
  return { ok: errors.length === 0, errors, value: errors.length === 0 ? parsed : null };
}

// The analyzed target may be a subdirectory of the git checkout (for example bench/seed-repo).
// Both the snapshot and the file listing must cover exactly the analyzed subtree. Using the
// `commit -- .` form keeps the paths relative to the target directory (a `commit:prefix` treeish
// is resolved against the repository root and yields an empty archive when the process cwd is the
// target subdirectory).
function listCommittedFiles(root, commit) {
  try {
    if (gitPrefix(root) === null) return [];
    return execFileResult("git", ["-C", root, "ls-tree", "-r", "--name-only", commit, "--", "."], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }).trim().split("\n").filter(Boolean);
  } catch (error) {
    return [];
  }
}

function execFileResult(command, args, options) {
  try {
    return execFileSync(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    // Some restricted hosts report EPERM after a child has exited successfully.
    if (error.code === "EPERM" && error.status === 0 && error.pid) return String(error.stdout || "");
    throw error;
  }
}

export function buildReproMessages({ finding, repoRoot, commit, excerpts }) {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence[0] : null;
  const path = evidence && evidence.path;
  const source = path && repoRoot && commit ? readFileAtCommit(repoRoot, commit, path) : null;
  const numbered = source === null ? String(excerpts || "(committed file unavailable)")
    : source.split("\n").map(function (line, index) { return String(index + 1) + " | " + line; }).join("\n");
  const files = repoRoot && commit ? listCommittedFiles(repoRoot, commit) : [];
  const review = { id: finding.id, title: finding.title, claim: finding.claim, evidence: finding.evidence };
  return [
    { role: "system", content: REPRO_SYSTEM_PROMPT },
    { role: "user", content: "Finding:\n" + JSON.stringify(review, null, 2) + "\n\nCited file " + (path || "unknown") + " with line numbers:\n" + numbered + "\n\nRepository files:\n" + files.join("\n") + "\n\nReturn the reproducer JSON." }
  ];
}

export function prepareSnapshot({ root, commit, workDir }) {
  let directory;
  try {
    if (!root || !commit) return { available: false, reason: "root and commit are required" };
    directory = mkdtempSync(join(workDir || tmpdir(), "codeproof-repro-"));
    const snapshotDir = join(directory, "snapshot");
    const tarPath = join(directory, "commit.tar");
    if (gitPrefix(root) === null) {
      rmSync(directory, { recursive: true, force: true });
      return { available: false, reason: "snapshot unavailable: not a git repository" };
    }
    mkdirSync(snapshotDir);
    execFileResult("git", ["-C", root, "archive", "--format=tar", "--output=" + tarPath, commit, "--", "."], { encoding: "utf8", timeout: 10000 });
    execFileResult("tar", ["-xf", tarPath, "-C", snapshotDir], { encoding: "utf8", timeout: 10000 });
    return { available: true, snapshotDir, cleanup: function () { rmSync(directory, { recursive: true, force: true }); } };
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    return { available: false, reason: "snapshot unavailable: " + error.message };
  }
}

export function classifyReproRun(result) {
  const stderr = String(result.stderr || "");
  if (result.killed || result.signal === "SIGTERM" || result.signal === "SIGKILL" || result.errorCode === "ETIMEDOUT") return "timeout";
  if (result.exitCode === 0) return "passed";
  if (/network disabled in repro sandbox/i.test(stderr)) return "sandbox-blocked";
  if (/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNKNOWN_FILE_EXTENSION|PermissionDenied|ERR_ACCESS_DENIED|Access to this API has been restricted/i.test(stderr)) return "invalid-test";
  if (/AssertionError|ERR_ASSERTION|Expected values to be strictly/i.test(stderr)) return "assertion-failure";
  return "error";
}

function executeNode(args, options) {
  return new Promise(function (resolve) {
    const started = Date.now();
    execFile("node", args, options, function (error, stdout, stderr) {
      const result = {
        exitCode: error ? (typeof error.code === "number" ? error.code : null) : 0,
        signal: error && error.signal ? error.signal : null,
        killed: Boolean(error && error.killed),
        errorCode: error && typeof error.code === "string" ? error.code : null,
        stdout: String(stdout || "").slice(0, 4096),
        stderr: String(stderr || "").slice(0, 4096),
        durationMs: Date.now() - started
      };
      result.classification = classifyReproRun(result);
      resolve(result);
    });
  });
}

export async function runReproTest({ testCode, snapshotDir, timeoutMs = 2000, attempts = 3 }) {
  const testPath = join(snapshotDir, ".codeproof-repro.test.mjs");
  const guardPath = join(snapshotDir, ".codeproof-repro-guard.mjs");
  let wroteTest = false;
  let wroteGuard = false;
  try {
    writeFileSync(testPath, testCode, { flag: "wx" });
    wroteTest = true;
    writeFileSync(guardPath, GUARD_CODE, { flag: "wx" });
    wroteGuard = true;
    const runs = [];
    const count = Math.max(1, Math.min(10, Number.isInteger(attempts) ? attempts : 3));
    for (let index = 0; index < count; index += 1) {
      runs.push(await executeNode(["--permission", "--allow-fs-read=" + snapshotDir, "--import", guardPath, testPath], {
        cwd: snapshotDir,
        timeout: timeoutMs,
        env: { PATH: process.env.PATH || "", HOME: snapshotDir, TMPDIR: snapshotDir, NODE_ENV: "test" },
        maxBuffer: 1024 * 1024,
        shell: false
      }));
    }
    const sameClass = runs.every(function (run) { return run.classification === runs[0].classification; });
    return { classification: sameClass ? runs[0].classification : "mixed", attempts: runs, deterministic: sameClass && runs[0].classification === "assertion-failure" };
  } catch (error) {
    return { classification: "error", attempts: [], deterministic: false, reason: "runner failed: " + error.message };
  } finally {
    if (wroteTest) rmSync(testPath, { force: true });
    if (wroteGuard) rmSync(guardPath, { force: true });
  }
}

function writeArtifacts(outDir, findingId, result, model, usage, costUsd) {
  if (!outDir) return null;
  const directory = join(outDir, "repro", findingId);
  mkdirSync(directory, { recursive: true });
  const testPath = join(directory, "test.mjs");
  const resultPath = join(directory, "result.json");
  if (result.testCode) writeFileSync(testPath, result.testCode);
  writeFileSync(resultPath, JSON.stringify({
    status: result.status,
    classification: result.classification,
    deterministic: result.deterministic,
    attempts: result.attempts,
    expectedBehavior: result.expectedBehavior,
    rationale: result.rationale,
    reason: result.reason,
    model,
    usage,
    costUsd
  }, null, 2) + "\n");
  return { test: result.testCode ? testPath : null, result: resultPath };
}

export async function attemptRepro({ finding, agent, repoRoot, commit, excerpts, config = {}, outDir }) {
  const started = Date.now();
  let model = null;
  let usage = null;
  let costUsd = null;
  const result = { status: "inconclusive", classification: null, attempts: [], deterministic: false,
    testCode: "", expectedBehavior: "", rationale: "", reason: "", artifacts: null };
  let snapshot = null;
  try {
    const call = await agent.complete({
      role: "repro",
      messages: buildReproMessages({ finding, repoRoot, commit, excerpts }),
      responseFormat: REPRO_RESPONSE_FORMAT,
      temperature: 0,
      maxTokens: config.reproMaxTokens || 4000
    });
    model = call.model || null;
    usage = call.usage || null;
    costUsd = call.costUsd === undefined ? null : call.costUsd;
    const parsed = parseReproResponse(call.text);
    const checked = validateReproL0(parsed);
    if (!checked.ok) throw new Error("reproducer failed L0: " + checked.errors.join("; "));
    if (parsed.findingId !== finding.id) throw new Error("reproducer findingId does not match finding");
    result.expectedBehavior = parsed.expectedBehavior;
    result.rationale = parsed.rationale;
    result.testCode = parsed.testCode;
    if (parsed.kind === "unsupported") {
      result.status = "unavailable";
      result.reason = parsed.unsupportedReason;
    } else {
      snapshot = prepareSnapshot({ root: repoRoot, commit, workDir: config.reproWorkDir });
      if (!snapshot.available) {
        result.status = "unavailable";
        result.reason = snapshot.reason;
      } else {
        const run = await runReproTest({ testCode: parsed.testCode, snapshotDir: snapshot.snapshotDir,
          timeoutMs: config.reproTimeoutMs || 2000, attempts: config.reproAttempts || 3 });
        result.classification = run.classification;
        result.attempts = run.attempts;
        result.deterministic = run.deterministic;
        result.status = run.deterministic && run.classification === "assertion-failure" ? "reproduced"
          : run.classification === "passed" ? "not-reproduced" : "inconclusive";
        result.reason = run.reason || (result.status === "reproduced" ? "assertion failed consistently on analyzed commit" : "test did not demonstrate the claim consistently");
      }
    }
  } catch (error) {
    if (error && error.code === "BUDGET_EXCEEDED") throw error;
    result.status = "inconclusive";
    result.reason = error.message;
  } finally {
    if (snapshot && snapshot.available) snapshot.cleanup();
  }
  result.durationMs = Date.now() - started;
  result.model = model;
  result.usage = usage;
  result.costUsd = costUsd;
  try {
    result.artifacts = writeArtifacts(outDir, finding.id, result, model, usage, costUsd);
  } catch (error) {
    result.reason += "; artifact write failed: " + error.message;
  }
  return result;
}

// Persist the reproducer artifacts once the run output directory is known.
export function writeReproArtifacts(outDir, findingId, repro) {
  if (!outDir || !repro) return null;
  try {
    return writeArtifacts(outDir, findingId, repro, repro.model || null, repro.usage || null, repro.costUsd === undefined ? null : repro.costUsd);
  } catch (error) {
    return null;
  }
}
