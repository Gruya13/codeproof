import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDirtyJson } from "../run/json.mjs";
import { gitPrefix, readFileAtCommit } from "../run/index.mjs";
import { assertionTiedToSymbols, hasDeadCode, hasExplicitThrow, hasTautology, inputsDiffer } from "./static-checks.mjs";
import { runLinkCheck } from "./linkcheck.mjs";

export const REPRO_SYSTEM_PROMPT = [
  "Write TWO Node ESM files for the finding: controlCode and testCode. It MUST import the real exported API from the repository using a path relative to its root. The root is the analyzed directory itself: every path in the file list is already relative to it, so import exactly as listed (for example './validation.ts', not './src/validation.ts' when the list shows 'validation.ts'). A test that does not import the analyzed repository code is not a reproducer and will be rejected. Node can import TypeScript directly.",
  "controlCode proves the environment: it asserts correct behavior and MUST PASS on the analyzed commit. testCode uses a different input, asserts the same correct behavior and MUST FAIL on the analyzed commit because of the claim. Both files call the same imported symbol with different arguments; do not repeat the same arguments in both files. Derive the expected behavior from the claim or a documented function contract; do not invent a new requirement.",
  "Example of a valid pair for a function page(items, offset, size): control 'assert.equal(page([1, 2], 0, 2).length, 2)' and trigger 'assert.equal(page([1, 2, 3, 4], 0, 2).length, 2)'. Both call page with different arguments and assert on the returned value. A pair that calls page with the same arguments twice, that asserts a constant ('assert.equal(2, 3)'), or whose assertion does not use the call result is rejected.",
  "If the claimed defect makes the code throw (a crash on some input), catch that error inside the test and turn it into an assertion failure: record the thrown error in a variable and assert on the recorded value. An uncaught runtime error is not recorded as an assertion failure and the reproducer will be reported as inconclusive instead of execution-proven.",
  "Do not write an explicit throw statement in either file; only node:assert may cause the test to fail.",
  "Every assertion must be tied to the imported symbol: a direct call, or an identifier assigned from such a call; do not assert on a constant or on a value that ignores the call result. Each file must be at most 45 lines. Use only node:assert/strict for assertions. Do not call assert.fail(), intercept process.exit, use require, make network calls (fetch, http, https, net), read files outside the repository, set a timeout longer than 1000 ms, or use infinite loops.",
  "If a faithful executable test needs a network, DOM, external file system, unavailable dependency, or environment not included in the repository, return kind unsupported with a specific reason instead of test code.",
  "Return only JSON matching the response schema. An unsupported response must have empty testCode and empty controlCode; never include code with kind unsupported."
].join("\n");

export const REPRO_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_reproducer",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["findingId", "kind", "controlCode", "testCode", "expectedBehavior", "rationale", "unsupportedReason"],
      properties: {
        findingId: { type: "string", pattern: "^F-[0-9]{3}$" },
        kind: { enum: ["test", "unsupported"] },
        controlCode: { type: "string" },
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
  // A URL string as test data is harmless: the sandbox has no network and the guard blocks
  // every network primitive. Only the calls themselves are forbidden (fetch/http/net/tls).
  [/node:(?:net|http|https|tls|dgram|child_process)\b/i, "network or child process module"],
  [/\bchild_process\b/i, "child process module"],
  [/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync)\s*\(/i, "file write"],
  [/\bsetTimeout\s*\([^,]+,\s*(?:[1-9]\d{3,}|[2-9]\d{2,})\s*\)/i, "long timeout"],
  [/\bconsole\s*\.\s*(?:error|warn|log|info|debug)\s*\(/i, "console output (it could mask the real failure class)"],
  [/\bprocess\s*\.\s*(?:stdout|stderr)\s*\.\s*write\s*\(/i, "direct stream output (it could mask the real failure class)"],
  [/\bMath\s*\.\s*random\s*\(/i, "non-deterministic Math.random (the proof must fail every run the same way)"],
  [/\bDate\s*\.\s*now\s*\(/i, "non-deterministic Date.now (the proof must fail every run the same way)"],
  [/\bnew\s+Date\s*\(/i, "non-deterministic Date construction (use fixed values instead)"],
  [/\bperformance\s*\.\s*now\s*\(/i, "non-deterministic performance.now"],
  [/\bprocess\s*\.\s*env\b/i, "process.env (the sandbox environment is empty on purpose)"],
  [/node:(?:fs|os|process|worker_threads|cluster)\b/i, "ambient runtime module"],
  [/\bassert\s*\.\s*ok\s*\(\s*true\s*[,)]/i, "trivial assertion assert.ok(true)"],
  [/\bassert\s*\.\s*(?:equal|strictEqual)\s*\(\s*-?1\s*,\s*-?1\s*[,)]/i, "trivial assertion (same literal on both sides)"],
  [/\bassert\s*\.\s*(?:equal|strictEqual)\s*\(\s*true\s*,\s*true\s*[,)]/i, "trivial assertion (same literal on both sides)"],
  [/\b(?:from|import\s*\(\s*|import\s+)['"](?:node:)?(?:fs|os|process|child_process|net|http|https|worker_threads|vm|inspector|cluster|tls|dgram)['"]/i, "ambient runtime module import"],
  [/\bprocess\s*\./i, "process access"],
  [/\bglobalThis\s*\.\s*process\b/i, "globalThis.process"]
];

const ASSERTION_PATTERN = /\bassert\s*\.\s*(?:ok|equal|strictEqual|notEqual|notStrictEqual|deepEqual|deepStrictEqual|match|doesNotMatch|throws|doesNotThrow|rejects|fails)\s*\(/;

// Identifiers bound by a STATIC relative import - the symbols a reproducer must actually call.
// Covers named imports (including aliases), default imports, namespace imports and combinations.
export function extractImportedIdentifiers(testCode) {
  const source = String(testCode || "");
  const names = [];
  const pattern = /import\s+(?:([A-Za-z_$][\w$]*)\s*(?:,\s*)?)?(?:\{([^}]*)\}\s*)?(?:\*\s+as\s+([A-Za-z_$][\w$]*)\s*)?from\s*['"](\.[^'"]+)['"]/g;
  let match = pattern.exec(source);
  while (match !== null) {
    const [, defaultName, namedBlock, namespaceName, relativePath] = match;
    if (defaultName) names.push(defaultName);
    if (namespaceName) names.push(namespaceName);
    if (namedBlock) {
      for (const part of namedBlock.split(",")) {
        const cleaned = part.trim();
        if (cleaned === "") continue;
        const alias = cleaned.split(/\s+as\s+/);
        const bound = (alias.length > 1 ? alias[1] : alias[0]).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(bound)) names.push(bound);
      }
    }
    if (!relativePath) { /* unreachable with this pattern, kept for clarity */ }
    match = pattern.exec(source);
  }
  return [...new Set(names)];
}

// Which imported repository symbols are actually used outside the import statements.
// Import statements may span several lines; strip whole statements, not single lines.
export function extractUsedImportedSymbols(testCode) {
  const source = String(testCode || "");
  const body = source
    .replace(/^[ \t]*import\b[\s\S]*?\bfrom\s*['"][^'"]+['"]\s*;?/gm, "")
    .replace(/^[ \t]*import\s*['"][^'"]+['"]\s*;?/gm, "");
  return extractImportedIdentifiers(source).filter(function (name) {
    return new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(body);
  });
}

export function parseReproResponse(text) {
  return parseDirtyJson(text);
}

// A reproducer is only meaningful if it exercises the analyzed repository code.
// Extract the relative import specifiers (ESM `from`/`import`, and dynamic `import()`).
export function extractReproImports(testCode) {
  const source = String(testCode || "");
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['\"](\.{1,2}\/[^'\"]+)['\"]/g;
  const found = [];
  let match = pattern.exec(source);
  while (match !== null) {
    if (found.indexOf(match[1]) === -1) found.push(match[1]);
    match = pattern.exec(source);
  }
  return found;
}

function validateCode(code, label, errors) {
  if (code.trim() === "") { errors.push(label + " is empty"); return; }
  if (code.split("\n").length > 45) errors.push(label + " exceeds 45 lines");
  if (!/node:assert(?:\/strict)?/.test(code)) errors.push(label + " must import node:assert");
  if (extractReproImports(code).length === 0) errors.push(label + " must import the analyzed repository code with a relative path");
  if (!ASSERTION_PATTERN.test(code)) errors.push(label + " must contain at least one node:assert assertion");
  const imported = extractImportedIdentifiers(code);
  const used = extractUsedImportedSymbols(code);
  if (imported.length === 0) errors.push(label + " must bind at least one symbol from the repository import");
  else if (used.length === 0) errors.push(label + " must call an imported repository symbol outside the import statements (imported: " + imported.join(", ") + ")");
  const tied = assertionTiedToSymbols(code, used.length > 0 ? used : imported);
  if (!tied.ok) errors.push(label + " assertion is not tied to a call of an imported symbol");
  if (hasDeadCode(code)) errors.push(label + " contains a dead-code guard");
  if (hasExplicitThrow(code)) errors.push(label + " must not throw explicitly; use node:assert for failures");
  const tautology = hasTautology(code);
  if (tautology) errors.push(label + " contains a tautological assertion (" + tautology + ")");
  for (const [pattern, thing] of FORBIDDEN_CODE) {
    if (pattern.test(code)) errors.push(label + ": forbidden " + thing);
  }
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
  for (const key of ["controlCode", "testCode", "expectedBehavior", "rationale", "unsupportedReason"]) {
    if (typeof parsed[key] !== "string") errors.push(key + " must be a string");
  }
  if (parsed.kind === "unsupported") {
    if (typeof parsed.testCode === "string" && parsed.testCode.trim() !== "") errors.push("unsupported response must not include testCode");
    if (typeof parsed.controlCode === "string" && parsed.controlCode.trim() !== "") errors.push("unsupported response must not include controlCode");
    if (typeof parsed.unsupportedReason === "string" && parsed.unsupportedReason.trim().length < 10) errors.push("unsupportedReason is too short");
  }
  if (parsed.kind === "test") {
    if (typeof parsed.expectedBehavior === "string" && parsed.expectedBehavior.trim().length < 10) errors.push("expectedBehavior is too short");
    if (typeof parsed.rationale === "string" && parsed.rationale.trim().length < 10) errors.push("rationale is too short");
    if (typeof parsed.controlCode === "string" && typeof parsed.testCode === "string") {
      validateCode(parsed.controlCode, "controlCode", errors);
      validateCode(parsed.testCode, "testCode", errors);
      const controlImports = extractImportedIdentifiers(parsed.controlCode);
      const triggerImports = extractImportedIdentifiers(parsed.testCode);
      const shared = controlImports.filter(function (name) { return triggerImports.indexOf(name) !== -1; });
      if (controlImports.length > 0 && triggerImports.length > 0 && shared.length === 0) errors.push("controlCode and testCode must call at least one common imported symbol");
      if (shared.length > 0) {
        const difference = inputsDiffer(parsed.controlCode, parsed.testCode, shared);
        if (!difference.ok) errors.push("control and trigger must use a different input: " + difference.reason);
      }
    }
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
  if (/^AssertionError \[ERR_ASSERTION\]:/m.test(stderr)) return "assertion-failure";
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

// A test can fail to run because the repository's own modules are not directly executable by
// Node: extensionless ESM specifiers (ERR_MODULE_NOT_FOUND) or a CommonJS require of a package
// that is not installed (Cannot find module 'picocolors'). Both are environment limits, not a
// failed reproducer. (Discovered on postcss, whose css-syntax-error.js requires picocolors.)
export function isInternalImportFailure(run) {
  if (!run || run.classification !== "invalid-test" || !Array.isArray(run.attempts)) return false;
  return run.attempts.some(function (attempt) {
    const stderr = String(attempt && attempt.stderr ? attempt.stderr : "");
    if (stderr.indexOf(".codeproof-repro.test.mjs") !== -1) return false;
    return /ERR_MODULE_NOT_FOUND|Cannot find module/.test(stderr);
  });
}

export async function runReproTest({ testCode, snapshotDir, timeoutMs = 2000, attempts = 3, expect = "assertion-failure" }) {
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
    const classification = sameClass ? runs[0].classification : "mixed";
    return { classification: classification, attempts: runs, deterministic: sameClass && classification === expect };
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
  const controlPath = join(directory, "control.mjs");
  const resultPath = join(directory, "result.json");
  if (result.controlCode) writeFileSync(controlPath, result.controlCode);
  if (result.testCode) writeFileSync(testPath, result.testCode);
  writeFileSync(resultPath, JSON.stringify({
    status: result.status,
    classification: result.classification,
    deterministic: result.deterministic,
    attempts: result.attempts,
    attemptCount: result.attemptCount,
    control: result.control || null,
    trigger: result.trigger || null,
    linkcheck: result.linkcheck || null,
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
  const result = { status: "inconclusive", classification: null, attempts: [], attemptCount: 0, deterministic: false,
    testCode: "", expectedBehavior: "", rationale: "", reason: "", artifacts: null };
  let snapshot = null;
  try {
    const baseMaxTokens = config.reproMaxTokens || 8000;
    const request = {
      role: "repro",
      messages: buildReproMessages({ finding, repoRoot, commit, excerpts }),
      responseFormat: REPRO_RESPONSE_FORMAT,
      temperature: 0,
      maxTokens: baseMaxTokens
    };
    let call = await agent.complete(request);
    // A truncated model response cannot be parsed. Retry once with a doubled budget,
    // the same way the scanner retries on truncation - L3 must not fail for a tooling reason.
    if (call.finishReason === "length") {
      const retry = await agent.complete({ ...request, maxTokens: baseMaxTokens * 2 });
      const sum = function (left, right) {
        const a = left || { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
        const b = right || { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
        return { inputTokens: (a.inputTokens || 0) + (b.inputTokens || 0), outputTokens: (a.outputTokens || 0) + (b.outputTokens || 0), cachedTokens: (a.cachedTokens || 0) + (b.cachedTokens || 0) };
      };
      const cost = (call.costUsd || 0) + (retry.costUsd || 0);
      retry.usage = sum(call.usage, retry.usage);
      retry.costUsd = cost;
      call = retry;
    }
    model = call.model || null;
    usage = call.usage || null;
    costUsd = call.costUsd === undefined ? null : call.costUsd;
    const parsed = parseReproResponse(call.text);
    const checked = validateReproL0(parsed);
    if (!checked.ok) throw new Error("reproducer failed L0: " + checked.errors.join("; "));
    if (parsed.findingId !== finding.id) throw new Error("reproducer findingId does not match finding");
    result.expectedBehavior = parsed.expectedBehavior;
    result.rationale = parsed.rationale;
    result.controlCode = parsed.controlCode;
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
        // Both codes must exercise code that actually exists in the analyzed snapshot.
        const declaredImports = extractReproImports(parsed.controlCode).concat(extractReproImports(parsed.testCode));
        const missing = [...new Set(declaredImports)].filter(function (specifier) {
          return !existsSync(join(snapshot.snapshotDir, specifier));
        });
        if (missing.length > 0) {
          result.status = "inconclusive";
          result.reason = "generated test imports paths that are not in the analyzed snapshot: " + missing.join(", ");
        } else {
          const attempts = Math.max(3, Math.min(10, Number.isInteger(config.reproAttempts) ? config.reproAttempts : 3));
          const timeoutMs = config.reproTimeoutMs || 2000;
          // Phase 1: the control must pass every run. If it does not, the environment or the call is invalid
          // and the trigger is never run, so a broken harness cannot be mistaken for a proof.
          const controlRun = await runReproTest({ testCode: parsed.controlCode, snapshotDir: snapshot.snapshotDir,
            timeoutMs: timeoutMs, attempts: attempts, expect: "passed" });
          result.control = { code: parsed.controlCode, classification: controlRun.classification, attempts: controlRun.attempts, deterministic: controlRun.deterministic };
          result.attemptCount = controlRun.attempts.length;
          if (!controlRun.deterministic) {
            result.status = "control-failed";
            result.classification = controlRun.classification;
            result.attempts = controlRun.attempts;
            result.reason = "control did not pass " + attempts + "/" + attempts + " on the analyzed commit (classification: " + controlRun.classification + "); the trigger was not run";
          } else {
            // Phase 2: the trigger must fail every run with an assertion error.
            const run = await runReproTest({ testCode: parsed.testCode, snapshotDir: snapshot.snapshotDir,
              timeoutMs: timeoutMs, attempts: attempts, expect: "assertion-failure" });
            result.trigger = { code: parsed.testCode, classification: run.classification, attempts: run.attempts, deterministic: run.deterministic };
            result.attemptCount = run.attempts.length;
            result.classification = run.classification;
            result.attempts = run.attempts;
            result.deterministic = run.deterministic;
            const internalImportFailure = isInternalImportFailure(run) || isInternalImportFailure(controlRun);
            if (internalImportFailure) {
              result.status = "unavailable";
              result.reason = "the repository's own imports are not directly executable by Node without a build step (extensionless specifiers or missing packages)";
            } else {
              result.status = run.deterministic && run.classification === "assertion-failure" ? "reproduced"
                : run.classification === "passed" ? "not-reproduced" : "inconclusive";
              result.reason = run.reason || (result.status === "reproduced" ? "control passed " + controlRun.attempts.length + "/" + controlRun.attempts.length + " and the trigger failed " + run.attempts.length + "/" + run.attempts.length + " with an assertion error on the analyzed commit" : "test did not demonstrate the claim consistently");
              if (result.status === "reproduced") {
                const imports = extractReproImports(parsed.testCode);
                const symbols = extractImportedIdentifiers(parsed.testCode);
                result.linkcheck = await runLinkCheck({ testCode: parsed.testCode, snapshotDir: snapshot.snapshotDir,
                  targetFile: imports[0], symbols: symbols, timeoutMs: 8000 });
                if (result.linkcheck.status !== "proven") {
                  result.reason += "; linkcheck " + result.linkcheck.status + " (" + (result.linkcheck.detail || "no detail") + ")";
                }
              }
            }
          }
        }
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
