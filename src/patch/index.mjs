// L4 (v0.2.0): surgical patch generation and the differential proof gate.
//
// A patch-proven finding is not a claim that the root cause is fixed. It is a differential result:
// after applying a minimal patch to a COPY of the L3 snapshot, the control still passes 3/3 and
// the trigger now passes 3/3. The repository's own test suite is never run.
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parseDirtyJson } from "../run/json.mjs";
import { runReproTest } from "../repro/index.mjs";

export const PATCH_SYSTEM_PROMPT = [
  "Return a minimal patch that makes the failing trigger test pass without breaking the passing control test. You receive one finding, its two generated test files and the full text of the cited file(s).",
  "The patch must target exactly one of the cited files. Provide searchBlock (an exact substring of the file, unique in it) and replaceBlock (its replacement). Keep the change surgical: at most 25 lines per block. Do not change the module's public API (export names and signatures), do not touch tests, fixtures, reports, package manifests, lock files or markdown, and do not add dependencies.",
  "If no faithful minimal patch is possible (the defect needs a larger redesign, an unavailable dependency or data you do not have), return kind unsupported with a concrete reason and empty blocks. That is a valid answer and is reported honestly.",
  "Return only JSON matching the response schema."
].join("\n");

export const PATCH_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_patcher",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["findingId", "kind", "targetFile", "searchBlock", "replaceBlock", "rationale", "unsupportedReason"],
      properties: {
        findingId: { type: "string", pattern: "^F-[0-9]{3}$" },
        kind: { enum: ["patch", "unsupported"] },
        targetFile: { type: "string" },
        searchBlock: { type: "string" },
        replaceBlock: { type: "string" },
        rationale: { type: "string" },
        unsupportedReason: { type: "string" }
      }
    }
  }
};

export const PATCH_LIMITS = { maxBlockLines: 25, forbiddenPrefixes: ["test/", "tests/", "bench/", "fixtures/", "reports/", ".github/"], forbiddenFiles: ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", ".env"], forbiddenExtensions: [".md"] };

export function sha256Text(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function parsePatchResponse(text) {
  return parseDirtyJson(text);
}

function exportNames(text) {
  const names = [];
  const pattern = /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) names.push(match[1]);
  names.sort();
  return names;
}

function hasDefaultExport(text) {
  return /export\s+default\b/.test(text);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + Math.max(1, needle.length));
  }
  return count;
}

export function validatePatchL0(parsed, options) {
  const limits = Object.assign({}, PATCH_LIMITS, (options && options.limits) || {});
  const finding = options && options.finding;
  const snapshotDir = options && options.snapshotDir;
  const errors = [];
  const warnings = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, errors: ["response must be an object"], value: null, warnings: warnings };
  const required = PATCH_RESPONSE_FORMAT.json_schema.schema.required;
  for (const key of required) if (!(key in parsed)) errors.push("missing " + key);
  for (const key of Object.keys(parsed)) if (!required.includes(key)) errors.push("unexpected " + key);
  if (!/^F-[0-9]{3}$/.test(String(parsed.findingId || ""))) errors.push("invalid findingId");
  if (finding && parsed.findingId !== finding.id) errors.push("findingId does not match the finding");
  if (parsed.kind !== "patch" && parsed.kind !== "unsupported") errors.push("invalid kind");
  if (parsed.kind === "unsupported") {
    if (parsed.targetFile) errors.push("unsupported response must not include targetFile");
    if (parsed.searchBlock) errors.push("unsupported response must not include searchBlock");
    if (parsed.replaceBlock) errors.push("unsupported response must not include replaceBlock");
    if (typeof parsed.unsupportedReason !== "string" || parsed.unsupportedReason.trim().length < 10) errors.push("unsupportedReason is too short");
    return { ok: errors.length === 0, errors, value: errors.length === 0 ? parsed : null, warnings };
  }
  const targetFile = typeof parsed.targetFile === "string" ? parsed.targetFile : "";
  const cited = finding && Array.isArray(finding.evidence) ? finding.evidence.map(function (item) { return item.path; }) : [];
  if (cited.length > 0 && cited.indexOf(targetFile) === -1) errors.push("targetFile is not one of the finding's cited files: " + cited.join(", "));
  for (const prefix of limits.forbiddenPrefixes) if (targetFile.startsWith(prefix)) errors.push("targetFile is in a protected path: " + prefix);
  if (limits.forbiddenFiles.indexOf(targetFile) !== -1) errors.push("targetFile is a protected file: " + targetFile);
  for (const extension of limits.forbiddenExtensions) if (targetFile.endsWith(extension)) errors.push("targetFile has a protected extension: " + extension);
  if (typeof parsed.searchBlock !== "string" || parsed.searchBlock.trim() === "") errors.push("searchBlock is empty");
  if (typeof parsed.replaceBlock !== "string" || parsed.replaceBlock.trim() === "") errors.push("replaceBlock is empty");
  if (errors.length === 0) {
    const searchLines = parsed.searchBlock.split("\n").length;
    const replaceLines = parsed.replaceBlock.split("\n").length;
    if (Math.max(searchLines, replaceLines) > limits.maxBlockLines) errors.push("patch block exceeds " + limits.maxBlockLines + " lines (search " + searchLines + ", replace " + replaceLines + ")");
    if (snapshotDir) {
      const path = join(snapshotDir, targetFile);
      if (!existsSync(path)) errors.push("targetFile does not exist in the analyzed snapshot: " + targetFile);
      else {
        const source = readFileSync(path, "utf8");
        const occurrences = countOccurrences(source, parsed.searchBlock);
        if (occurrences !== 1) errors.push("searchBlock must occur exactly once in the target file (found " + occurrences + ")");
        const before = exportNames(parsed.searchBlock);
        const after = exportNames(parsed.replaceBlock);
        if (JSON.stringify(before) !== JSON.stringify(after)) errors.push("the patch must not change the module's exported names");
        if (hasDefaultExport(parsed.searchBlock) !== hasDefaultExport(parsed.replaceBlock)) errors.push("the patch must not add or remove the default export");
        if (options && options.testCode) {
          const literals = (parsed.replaceBlock.match(/"[^"]{1,40}"|'[^']{1,40}'|\b\d{1,6}\b/g) || []);
          const leaked = literals.filter(function (literal) { return options.testCode.indexOf(literal) !== -1; });
          if (leaked.length > 0) warnings.push("replaceBlock contains literals that also appear in the generated test (possible overfitting): " + leaked.slice(0, 3).join(", "));
        }
      }
    }
  }
  if (typeof parsed.rationale !== "string" || parsed.rationale.trim().length < 10) errors.push("rationale is too short");
  return { ok: errors.length === 0, errors, value: errors.length === 0 ? parsed : null, warnings };
}

export function copySnapshot(snapshotDir, workDir) {
  const directory = mkdtempSync(join(workDir || tmpdir(), "codeproof-patch-"));
  const copyDir = join(directory, "snapshot");
  cpSync(snapshotDir, copyDir, { recursive: true });
  return { directory, copyDir, cleanup: function () { rmSync(directory, { recursive: true, force: true }); } };
}

export function applyPatchToSnapshot(options) {
  const path = join(options.snapshotDir, options.targetFile);
  const source = readFileSync(path, "utf8");
  const occurrences = countOccurrences(source, options.searchBlock);
  if (occurrences !== 1) throw new Error("searchBlock must occur exactly once in " + options.targetFile + " (found " + occurrences + ")");
  const patched = source.replace(options.searchBlock, options.replaceBlock);
  writeFileSync(path, patched);
  return { before: source, after: patched };
}

export function unifiedDiff(before, after, options) {
  const beforeLines = String(before).split("\n");
  const afterLines = String(after).split("\n");
  const label = (options && options.label) || "patch";
  const start = beforeLines.findIndex(function (line, index) { return line !== afterLines[index]; });
  if (start === -1 && beforeLines.length === afterLines.length) return "";
  let beforeEnd = beforeLines.length;
  let afterEnd = afterLines.length;
  while (beforeEnd > start && afterEnd > start && beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]) { beforeEnd -= 1; afterEnd -= 1; }
  const lines = ["--- a/" + label, "+++ b/" + label, "@@ -" + (start + 1) + "," + Math.max(1, beforeEnd - start) + " +" + (start + 1) + "," + Math.max(1, afterEnd - start) + " @@"];
  for (let index = start; index < beforeEnd; index += 1) lines.push("-" + beforeLines[index]);
  for (let index = start; index < afterEnd; index += 1) lines.push("+" + afterLines[index]);
  return lines.join("\n");
}

export async function runPatchGate(options) {
  const attempts = options.attempts || 3;
  const timeoutMs = options.timeoutMs || 2000;
  const copy = copySnapshot(options.snapshotDir, options.workDir);
  const result = { status: "inconclusive", diff: null, control: null, trigger: null, reason: null };
  try {
    const applied = applyPatchToSnapshot({ snapshotDir: copy.copyDir, targetFile: options.targetFile, searchBlock: options.searchBlock, replaceBlock: options.replaceBlock });
    result.diff = unifiedDiff(applied.before, applied.after, { label: options.targetFile });
    const control = await runReproTest({ testCode: options.controlCode, snapshotDir: copy.copyDir, timeoutMs: timeoutMs, attempts: attempts, expect: "passed" });
    result.control = { classification: control.classification, attempts: control.attempts, deterministic: control.deterministic };
    if (!control.deterministic) {
      result.status = "rejected";
      result.reason = "the patch breaks the control (control " + control.classification + " after applying it)";
      return result;
    }
    const trigger = await runReproTest({ testCode: options.testCode, snapshotDir: copy.copyDir, timeoutMs: timeoutMs, attempts: attempts, expect: "passed" });
    result.trigger = { classification: trigger.classification, attempts: trigger.attempts, deterministic: trigger.deterministic };
    if (trigger.deterministic) {
      result.status = "patch-proven";
      result.reason = "control passed 3/3 and the trigger passed 3/3 after the patch (differential proof)";
    } else {
      result.status = "rejected";
      result.reason = "the trigger still fails after the patch (" + trigger.classification + ")";
    }
    return result;
  } finally {
    copy.cleanup();
  }
}

export function buildPatchMessages({ finding, controlCode, testCode, repoRoot, commit, excerpts }) {
  return [
    { role: "system", content: PATCH_SYSTEM_PROMPT },
    { role: "user", content: "Finding:\n" + JSON.stringify({ id: finding.id, title: finding.title, claim: finding.claim, evidence: finding.evidence }, null, 2) + "\n\nCONTROL (must keep passing):\n" + controlCode + "\n\nTRIGGER (must pass after the patch):\n" + testCode + "\n\nReturn the patch JSON." }
  ];
}

export async function attemptPatch(options) {
  const started = Date.now();
  const finding = options.finding;
  const agent = options.agent;
  const config = options.config || {};
  const result = { status: "unsupported", diff: null, searchBlockSha256: null, replaceBlockSha256: null, rationale: null, attempts: null, warnings: [], model: null, usage: null, costUsd: null, reason: null, durationMs: 0 };
  try {
    const request = {
      role: "patcher",
      messages: buildPatchMessages({ finding: finding, controlCode: options.controlCode, testCode: options.testCode, repoRoot: options.repoRoot, commit: options.commit, excerpts: options.excerpts }),
      responseFormat: PATCH_RESPONSE_FORMAT,
      temperature: 0,
      maxTokens: config.patchMaxTokens || 6000
    };
    const call = await agent.complete(request);
    result.model = call.model || null;
    result.usage = call.usage || null;
    result.costUsd = call.costUsd === undefined ? null : call.costUsd;
    const parsed = parsePatchResponse(call.text);
    result.rationale = parsed.rationale || null;
    if (parsed.kind === "unsupported") {
      const checked = validatePatchL0(parsed, { finding: finding });
      if (!checked.ok) throw new Error("patcher failed L0: " + checked.errors.join("; "));
      result.status = "unsupported";
      result.reason = parsed.unsupportedReason;
      return result;
    }
    const snapshot = options.snapshotDir;
    const checked = validatePatchL0(parsed, { finding: finding, snapshotDir: snapshot, testCode: options.testCode, limits: config.patchLimits });
    result.warnings = checked.warnings || [];
    if (!checked.ok) throw new Error("patcher failed L0: " + checked.errors.join("; "));
    result.searchBlockSha256 = sha256Text(parsed.searchBlock);
    result.replaceBlockSha256 = sha256Text(parsed.replaceBlock);
    const gate = await runPatchGate({
      snapshotDir: snapshot,
      targetFile: parsed.targetFile,
      searchBlock: parsed.searchBlock,
      replaceBlock: parsed.replaceBlock,
      controlCode: options.controlCode,
      testCode: options.testCode,
      workDir: config.patchWorkDir,
      attempts: config.reproAttempts || 3,
      timeoutMs: config.reproTimeoutMs || 2000
    });
    result.diff = gate.diff;
    result.attempts = { control: gate.control, trigger: gate.trigger };
    result.status = gate.status;
    result.reason = gate.reason;
  } catch (error) {
    if (error && error.code === "BUDGET_EXCEEDED") throw error;
    result.status = "rejected";
    result.reason = error.message;
  }
  result.durationMs = Date.now() - started;
  return result;
}

export function writePatchArtifacts(outDir, findingId, patch) {
  if (!outDir || !patch) return null;
  const directory = join(outDir, "patch");
  mkdirSync(directory, { recursive: true });
  const diffPath = join(directory, findingId + ".diff");
  const recordPath = join(directory, findingId + ".json");
  writeFileSync(diffPath, (patch.diff || "(no diff)") + "\n");
  writeFileSync(recordPath, JSON.stringify({
    status: patch.status,
    rationale: patch.rationale || null,
    warnings: patch.warnings || [],
    searchBlockSha256: patch.searchBlockSha256 || null,
    replaceBlockSha256: patch.replaceBlockSha256 || null,
    attempts: patch.attempts || null,
    reason: patch.reason || null,
    model: patch.model || null,
    costUsd: patch.costUsd === undefined ? null : patch.costUsd
  }, null, 2) + "\n");
  return { diff: diffPath, record: recordPath };
}