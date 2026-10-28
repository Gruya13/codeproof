// Offline replay for v2 reports (F3). Re-verifies a report from its artifacts and the analyzed
// repository without any model call: attestation hashes, config payload hash, optional git anchor,
// L1 citations, L3 control/trigger executions and L4 patch application. The semantic L2 verdict of
// the original run is NOT re-executed - that bound is stated in the output and in README Limits.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configPayloadSha256 } from "../config.mjs";
import { verifyAttestation } from "./attest.mjs";
import { ingest } from "../ingest/index.mjs";
import { checkCitation } from "../verify/index.mjs";
import { prepareSnapshot, runReproTest } from "../repro/index.mjs";
import { runPatchGate, validateTargetFile } from "../patch/index.mjs";

export const REPLAY_SCHEMA_VERSION = 2;

function git(args, cwd) {
  return execFileSync("git", args, { cwd: cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function gitTop(dir) {
  try { return git(["rev-parse", "--show-toplevel"], dir); } catch (error) { return null; }
}

function anchorCheck(reportDir, anchor) {
  const top = gitTop(reportDir);
  if (!top) return { ok: false, problem: "report directory is not inside a git checkout; cannot anchor" };
  const relative = resolve(reportDir).slice(resolve(top).length + 1).replace(/\\/g, "/");
  if (!relative) return { ok: false, problem: "report directory is the git root; anchor a concrete report directory" };
  try { git(["rev-parse", "--verify", anchor + "^{commit}"], top); } catch (error) { return { ok: false, problem: "anchor revision is not in this repository: " + anchor }; }
  let diff = "";
  try { diff = git(["diff", anchor, "--", relative], top); } catch (error) { return { ok: false, problem: "git diff against the anchor failed: " + error.message }; }
  if (diff !== "") return { ok: false, problem: "the report directory differs from the anchor revision" };
  const status = git(["status", "--porcelain", "--", relative], top);
  if (status !== "") return { ok: false, problem: "the report directory has uncommitted changes" };
  return { ok: true, top: top, relative: relative };
}

async function replayTrace(options) {
  const reportDir = resolve(options.reportDir);
  const run = JSON.parse(readFileSync(join(reportDir, "run.json"), "utf8"));
  const findings = JSON.parse(readFileSync(join(reportDir, "findings.json"), "utf8"));
  const result = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    reportDir: reportDir,
    mode: run.configHashVersion === 2 && run.attestation ? "v2" : "v1",
    anchor: options.anchor || null,
    gitAnchored: false,
    attestation: null,
    findings: [],
    mismatches: [],
    problems: [],
    notes: []
  };
  const isV2 = result.mode === "v2";
  if (!isV2) result.notes.push("v1 report: only L0/L1 are mechanically replayable; L2/L3/L4 are not replayable (v1)");
  if (isV2) {
    const attestationProblems = verifyAttestation(reportDir, run.attestation);
    result.attestation = {
      schemaVersion: run.attestation.schemaVersion,
      findingsSha256: run.attestation.findingsSha256 || null,
      artifacts: Object.keys(run.attestation.artifacts || {}).length,
      problems: attestationProblems
    };
    for (const problem of attestationProblems) result.problems.push("attestation: " + problem);
    if (run.config && run.config.payload) {
      const recomputed = configPayloadSha256(run.config.payload);
      if (recomputed !== run.configSha256) result.problems.push("config payload does not hash to configSha256");
    } else {
      result.problems.push("v2 run is missing config.payload");
    }
    if (options.anchor) {
      const anchor = anchorCheck(reportDir, options.anchor);
      result.gitAnchored = anchor.ok;
      if (!anchor.ok) result.problems.push("git anchor: " + anchor.problem);
    } else {
      result.notes.push("not git-anchored (claim limited to tamper-evident on disk; pass --anchor <rev> for the full claim)");
    }
  }

  const repoPath = options.repoPath || (run.repo && run.repo.path) || null;
  let repo = null;
  if (repoPath && existsSync(repoPath)) {
    try {
      const ingested = ingest(repoPath, { commit: run.repo && run.repo.commit ? run.repo.commit : undefined });
      repo = { root: repoPath, commit: run.repo ? run.repo.commit : null, manifest: new Map(ingested.files.map(function (file) { return [file.path, file]; })) };
    } catch (error) {
      result.notes.push("repository checkout could not be read: " + error.message);
      if (isV2) result.problems.push("repository checkout could not be read: " + error.message);
    }
  } else {
    result.notes.push("repository checkout is not available; L1/L3/L4 executions are skipped");
    if (isV2) result.problems.push("repository checkout is not available; L1/L3/L4 executions are incomplete");
  }

  let snapshot = null;
  const needExecution = repo && isV2 && result.problems.length === 0 && findings.some(function (item) { return item.repro && item.repro.controlCode && item.repro.testCode; });
  if (needExecution) {
    snapshot = prepareSnapshot({ root: repo.root, commit: repo.commit, workDir: options.workDir });
    if (!snapshot.available) {
      result.notes.push("snapshot unavailable: " + snapshot.reason);
      result.problems.push("snapshot unavailable; L3/L4 executions are incomplete: " + snapshot.reason);
      snapshot = null;
    }
  }
  try {
    for (const item of findings) {
      const finding = item.finding || {};
      const evidence = Array.isArray(finding.evidence) ? finding.evidence[0] : null;
      const entry = {
        id: finding.id,
        status: item.status,
        evidenceLevel: item.evidenceLevel || null,
        l1: null,
        l3: null,
        l4: null
      };
      if (repo) {
        const l1 = checkCitation(evidence, repo);
        entry.l1 = { passed: Boolean(l1.passed), reason: l1.reason || null };
        if (!l1.passed) result.mismatches.push(finding.id + ": L1 citation no longer matches: " + l1.reason);
      }
      if (snapshot && item.repro && item.repro.controlCode && item.repro.testCode) {
        const control = await runReproTest({ testCode: item.repro.controlCode, snapshotDir: snapshot.snapshotDir, timeoutMs: options.timeoutMs || 2000, attempts: options.attempts || 1, expect: "passed" });
        const trigger = await runReproTest({ testCode: item.repro.testCode, snapshotDir: snapshot.snapshotDir, timeoutMs: options.timeoutMs || 2000, attempts: options.attempts || 1, expect: "assertion-failure" });
        entry.l3 = { control: control.classification, trigger: trigger.classification };
        const recordedControl = item.repro.control ? item.repro.control.classification : null;
        const recordedTrigger = item.repro.trigger ? item.repro.trigger.classification : null;
        if (recordedControl && recordedControl !== control.classification) result.mismatches.push(finding.id + ": L3 control classification changed (" + recordedControl + " -> " + control.classification + ")");
        if (recordedTrigger && recordedTrigger !== trigger.classification) result.mismatches.push(finding.id + ": L3 trigger classification changed (" + recordedTrigger + " -> " + trigger.classification + ")");
        if (item.patch && item.patch.status === "patch-proven" && item.patch.searchBlock && item.patch.replaceBlock) {
          const target = validateTargetFile(item.patch.targetFile, snapshot.snapshotDir);
          if (!target.ok) {
            entry.l4 = { status: "invalid-target", reason: target.reason };
            result.problems.push(finding.id + ": L4 invalid targetFile: " + target.reason);
          } else {
            const gate = await runPatchGate({
              snapshotDir: snapshot.snapshotDir,
              targetFile: item.patch.targetFile,
              searchBlock: item.patch.searchBlock,
              replaceBlock: item.patch.replaceBlock,
              controlCode: item.repro.controlCode,
              testCode: item.repro.testCode,
              workDir: options.workDir,
              attempts: options.attempts || 1,
              timeoutMs: options.timeoutMs || 2000
            });
            entry.l4 = { status: gate.status, reason: gate.reason };
            if (gate.status !== "patch-proven") result.mismatches.push(finding.id + ": L4 patch no longer proves (" + gate.status + ": " + gate.reason + ")");
          }
        } else if (item.patch && item.patch.status && item.patch.status !== "patch-proven") {
          entry.l4 = { status: item.patch.status, note: "unsupported patches are not re-applied" };
        }
      }
      result.findings.push(entry);
    }
  } finally {
    if (snapshot && snapshot.available) snapshot.cleanup();
  }
  result.matches = result.mismatches.length === 0 && result.problems.length === 0;
  result.resultHash = hashJson({ mode: result.mode, findings: result.findings, mismatches: result.mismatches, problems: result.problems });
  return result;
}

export async function replayRun(options) {
  return replayTrace(options);
}

export function formatReplay(result) {
  const lines = [];
  lines.push("# Replay " + (result.mode === "v2" ? "(v2, mechanical L1-L4)" : "(v1, limited to L0/L1)"));
  lines.push("");
  lines.push("Report: " + result.reportDir);
  lines.push("Anchor: " + (result.anchor ? result.anchor + (result.gitAnchored ? " (verified)" : " (NOT verified)") : "none (tamper-evident on disk only)"));
  lines.push("Attestation: " + (result.attestation ? result.attestation.artifacts + " artifacts, " + result.attestation.problems.length + " problems" : "not present (v1)"));
  lines.push("");
  lines.push("| Finding | Status | L1 | L3 control/trigger | L4 |");
  lines.push("|---|---|---|---|---|");
  for (const entry of result.findings) {
    lines.push("| " + entry.id + " | " + entry.status + " | " + (entry.l1 ? (entry.l1.passed ? "pass" : "FAIL") : "n/a") + " | " + (entry.l3 ? entry.l3.control + " / " + entry.l3.trigger : "n/a") + " | " + (entry.l4 ? entry.l4.status : "n/a") + " |");
  }
  lines.push("");
  if (result.notes.length > 0) { lines.push("Notes:"); for (const note of result.notes) lines.push("- " + note); lines.push(""); }
  if (result.problems.length > 0) { lines.push("Problems:"); for (const problem of result.problems) lines.push("- " + problem); lines.push(""); }
  if (result.mismatches.length > 0) { lines.push("Mismatches:"); for (const mismatch of result.mismatches) lines.push("- " + mismatch); lines.push(""); }
  lines.push(result.matches ? "REPLAY PASS: every replayed check matches the recorded report" : "REPLAY FAIL: the recorded report does not replay");
  lines.push("resultHash: " + result.resultHash);
  return lines.join("\n");
}
