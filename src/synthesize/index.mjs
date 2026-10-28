import { readFileAtCommit } from "../run/index.mjs";

function fence() {
  return "```";
}

function runs(phase, fallback) {
  return phase && Array.isArray(phase.attempts) && phase.attempts.length > 0 ? phase.attempts.length : fallback;
}

function ratio(count) {
  return count + "/" + count;
}

function escapeMermaidText(value) {
  return value.replace(/"/g, "#quot;").replace(/\r\n?|\n/g, "<br/>").replace(/[\x00-\x1f\x7f]/g, "");
}

export function mermaidGraph(repo) {
  const ids = new Map();
  repo.files.forEach(function (file, index) { ids.set(file.path, "n" + index); });
  const lines = ["graph LR"];
  for (const pair of ids) {
    const label = escapeMermaidText(pair[0]);
    lines.push("  " + pair[1] + '["' + label + '"]');
  }
  for (const edge of repo.edges) lines.push("  " + ids.get(edge.from) + " --> " + ids.get(edge.to));
  for (const cycle of repo.cycles) lines.push("  %% cycle: " + cycle.map(escapeMermaidText).join(" -> "));
  return lines.join("\n");
}

function citationBlock(finding, source) {
  const lines = [];
  for (const evidence of finding.evidence) {
    const committed = source && source.root && source.commit
      ? readFileAtCommit(source.root, source.commit, evidence.path)
      : null;
    const committedLines = committed === null ? null : committed.split("\n");
    const available = committedLines !== null && evidence.startLine >= 1 && evidence.endLine <= committedLines.length;
    lines.push(available
      ? "**Citation (from commit, lines " + evidence.startLine + "-" + evidence.endLine + "):** " + evidence.path
      : "**Citation (model-provided snippet; file not in commit):** " + evidence.path + ":" + evidence.startLine + "-" + evidence.endLine);
    lines.push(fence() + "text");
    lines.push(available
      ? committedLines.slice(evidence.startLine - 1, evidence.endLine).join("\n")
      : evidence.snippet);
    lines.push(fence());
  }
  return lines;
}

export function buildReport(options) {
  const repo = options.repo;
  const published = options.published;
  const run = options.run;
  const configuredRuns = run.repro && Number.isInteger(run.repro.attempts) ? run.repro.attempts : 3;
  const verified = published.filter(function (item) { return item.status === "verified"; });
  const lines = [];
  lines.push("# CodeProof report");
  lines.push("");
  lines.push("Commit: " + run.repo.commit + "  |  run-id: " + run.runId + "  |  mode: " + run.mode);
  lines.push("");
  if (run.mock) {
    lines.push("> **MOCK MODE** - this run used the mock adapter. No model was called and no network was used; the numbers are synthetic.");
    lines.push("");
  }
  if (run.mode === "controlled-verifier") {
    lines.push("> **CONTROLLED VERIFIER TEST** - the candidates in this report were injected directly into the verifier. They are not scanner output and must not be presented as a scan.");
    lines.push("");
  }
  lines.push("**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push("| Files / LOC | " + repo.files.length + " / " + repo.loc + " |");
  lines.push("| Import edges / cycles | " + repo.edges.length + " / " + repo.cycles.length + " |");
  if (run.scanCoverage) {
    const coverage = run.scanCoverage;
    lines.push("| Files in scanner prompt | " + coverage.filesInPrompt + " / " + coverage.filesTotal + (coverage.truncated ? " (truncated at " + coverage.cap + " chars)" : "") + " |");
  }
  lines.push("| Findings proposed | " + run.findings.proposed + " |");
  lines.push("| Rejected at L1 (bad citation) | " + run.findings.l1Rejected + " |");
  lines.push("| Verified | " + run.findings.verified + " |");
  const reproducedCount = published.filter(function (item) { return item.repro && item.repro.status === "reproduced"; }).length;
  const executionEnabled = Boolean(run.repro && run.repro.enabled);
  if (executionEnabled) lines.push("| Reproduced by execution (L3) | " + reproducedCount + " |");
  const patchedCount = published.filter(function (item) { return item.patch && item.patch.status === "patch-proven"; }).length;
  if (patchedCount > 0) lines.push("| Patch-proven (L4, differential) | " + patchedCount + " |");
  lines.push("| Moderate confidence | " + run.findings.moderate + " |");
  lines.push("| Refuted | " + run.findings.refuted + " |");
  lines.push("| Uncertain | " + run.findings.uncertain + " |");
  lines.push("| Calls / retries | " + run.calls + " / " + run.retries + " |");
  lines.push("| Tokens in / out | " + run.usage.inputTokens + " / " + run.usage.outputTokens + " |");
  lines.push("| Cached input tokens | " + run.usage.cachedTokens + " |");
  lines.push("| Cost | " + (run.usage.measured ? "$" + Number(run.usage.costUsd).toFixed(4) : "not measured (mock)") + " |");
  lines.push("");
  lines.push("## Verified findings");
  lines.push("");
  if (verified.length === 0) {
    lines.push("_None this run._");
    lines.push("");
  }
  for (const item of verified) {
    const finding = item.finding;
    lines.push("### " + finding.id + " - " + finding.severity + " - " + finding.title);
    lines.push("");
    lines.push("**Claim:** " + finding.claim);
    lines.push("");
    if (Array.isArray(item.proposedBy) && item.proposedBy.length > 0) {
      const labels = item.proposedBy.map(function (label) {
        if (label === "spark") return "Muse Spark";
        if (label === "wonder") return "Muse Wonder";
        if (label === "controlled") return "injected candidate";
        return label;
      });
      lines.push("**Proposed by:** " + (labels.length > 1 ? labels.join(" + ") : labels[0]));
      lines.push("");
    }
    const itemRepro = item.repro;
    const controlRuns = runs(itemRepro && itemRepro.control, itemRepro && itemRepro.attemptCount || configuredRuns);
    const triggerRuns = runs(itemRepro && itemRepro.trigger, itemRepro && itemRepro.attemptCount || configuredRuns);
    const executionProven = Boolean(itemRepro && itemRepro.status === "reproduced" && itemRepro.linkcheck && itemRepro.linkcheck.status === "proven");
    lines.push("**Evidence level:** citation-proven + adversarially-confirmed" + (executionProven ? " + **execution-proven (generated test fails on the analyzed commit)**" : ""));
    lines.push("");
    if (itemRepro) {
      const linkcheckSuffix = itemRepro.linkcheck && itemRepro.linkcheck.status !== "proven"
        ? " [linkcheck " + itemRepro.linkcheck.status + (": " + (itemRepro.linkcheck.detail || "") + "]")
        : "";
      const executionCheck = itemRepro.status === "reproduced"
        ? "reproduced by execution: the control passed " + ratio(controlRuns) + " and the trigger failed " + ratio(triggerRuns) + " (see Reproduced by execution)" + linkcheckSuffix
        : itemRepro.status === "control-failed"
          ? "control failed: the control test did not pass " + ratio(controlRuns) + ", so the trigger was not run (" + (itemRepro.reason || "") + ")"
          : itemRepro.status === "not-reproduced"
            ? "not reproduced: the generated test passed on the analyzed commit"
            : itemRepro.status === "unavailable"
              ? "unavailable: " + (itemRepro.reason || "no faithful executable test could be written")
              : "inconclusive: " + (itemRepro.reason || "the generated test could not settle the claim");
      lines.push("**Execution check:** " + executionCheck);
      lines.push("");
    }
    const citation = citationBlock(finding, { root: options.repoRoot || (run.repo && run.repo.path), commit: run.repo && run.repo.commit });
    lines.push(citation.join("\n"));
    lines.push("");
    lines.push("**Verifier (" + item.verifier.model + "):** " + item.verifier.verdict + " - " + item.verifier.reason);
    lines.push("");
  }
  const reproducedItems = verified.filter(function (item) { return item.repro && item.repro.status === "reproduced"; });
  if (reproducedItems.length > 0) {
    lines.push("## Reproduced by execution");
    lines.push("");
    lines.push("For each finding below, the verifier model wrote two standalone files. They run on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, at least three runs each.");
    lines.push("");
    lines.push("- **[CONTROL]** uses a clean, normal input and must pass every run. It proves the environment and the way the API is called are valid; if it fails, the finding is reported as `control-failed` and the trigger is never run.");
    lines.push("- **[TRIGGER]** uses a different input and must fail every run with an assertion error on the analyzed commit.");
    lines.push("- **LinkCheck** (Node 26) runs the trigger under the permission model with inspector coverage and requires that the imported symbol actually executed. Without that linkage proof the finding is not reported as execution-proven.");
    lines.push("");
    lines.push("");
    for (const item of reproducedItems) {
      const finding = item.finding;
      const itemRepro = item.repro;
      const controlRuns = runs(itemRepro.control, itemRepro.attemptCount || configuredRuns);
      const triggerRuns = runs(itemRepro.trigger, itemRepro.attemptCount || configuredRuns);
      lines.push("### " + finding.id + " - " + finding.title);
      lines.push("");
      if (itemRepro.expectedBehavior) { lines.push("**Expected behavior:** " + itemRepro.expectedBehavior); lines.push(""); }
      if (itemRepro.controlCode) {
        lines.push("**Control (must pass " + ratio(controlRuns) + " on the analyzed commit):**");
        lines.push(fence() + "js");
        lines.push(String(itemRepro.controlCode).trim());
        lines.push(fence());
        lines.push("");
      }
      lines.push("**Trigger (must fail " + ratio(triggerRuns) + " with an assertion error on the analyzed commit):**");
      lines.push(fence() + "js");
      lines.push(String(itemRepro.testCode || "").trim());
      lines.push(fence());
      lines.push("");
      if (itemRepro.linkcheck) {
        lines.push("**LinkCheck:** " + itemRepro.linkcheck.status + (itemRepro.linkcheck.detail ? " (" + itemRepro.linkcheck.detail + ")" : "") + (itemRepro.linkcheck.status === "unproven" ? " - reported as verified, not execution-proven." : " - the imported symbol executed under inspector coverage."));
        lines.push("");
      }
      const attempts = Array.isArray(itemRepro.attempts) ? itemRepro.attempts : [];
      const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
      if (lastAttempt && lastAttempt.stderr) {
        lines.push("**Runner output (last of " + attempts.length + " attempts):**");
        lines.push(fence() + "text");
        lines.push(String(lastAttempt.stderr).trim().split("\n").slice(-15).join("\n"));
        lines.push(fence());
        lines.push("");
      }
    }
  }
  const patchedItems = verified.filter(function (item) { return item.patch && item.patch.status === "patch-proven"; });
  if (patchedItems.length > 0) {
    lines.push("## Patch-proven (differential proof)");
    lines.push("");
    lines.push("For each finding below the patcher model proposed a minimal patch to one of the cited files. The patch is applied to a **copy** of the L3 snapshot (the snapshot itself is never mutated) and both phases are re-run: the control must still pass every run and the trigger must now pass every run. This is a differential result over the reproduction - it does not claim to fix the root cause, and the repository's own test suite is not run.");
    lines.push("");
    for (const item of patchedItems) {
      const finding = item.finding;
      const itemPatch = item.patch;
      lines.push("### " + finding.id + " - " + finding.title);
      lines.push("");
      if (itemPatch.rationale) { lines.push("**Patch rationale:** " + itemPatch.rationale); lines.push(""); }
      lines.push(fence() + "diff");
      lines.push(String(itemPatch.diff || "(no diff)").trim());
      lines.push(fence());
      lines.push("");
      const control = itemPatch.attempts && itemPatch.attempts.control ? itemPatch.attempts.control : null;
      const trigger = itemPatch.attempts && itemPatch.attempts.trigger ? itemPatch.attempts.trigger : null;
      lines.push("**Differential result:** control " + (control ? control.classification : "?") + " " + ratio(runs(control, configuredRuns)) + ", trigger " + (trigger ? trigger.classification : "?") + " " + ratio(runs(trigger, configuredRuns)) + " after the patch. The repository's own test suite was not run; the patch was never written to the analyzed repository.");
      lines.push("");
      if (Array.isArray(itemPatch.warnings) && itemPatch.warnings.length > 0) { lines.push("**Warnings:** " + itemPatch.warnings.join("; ")); lines.push(""); }
    }
  }
  lines.push("## Architecture");
  lines.push("");
  lines.push("Deterministic facts only: " + repo.files.length + " files, " + repo.loc + " LOC, " + repo.edges.length + " import edges, " + repo.cycles.length + " cycles. The diagram is generated from the import graph by code, never by the model.");
  lines.push("");
  lines.push(fence() + "mermaid");
  lines.push(mermaidGraph(repo));
  lines.push(fence());
  lines.push("");
  lines.push("## Limits");
  lines.push("");
  lines.push("- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.");
  lines.push("- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.");
  lines.push("- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.");
  lines.push("- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.");
  lines.push("");
  return lines.join("\n");
}

export function buildRejected(options) {
  const published = options.published;
  const run = options.run;
  const candidates = options.candidates || [];
  const l0Rejected = candidates.filter(function (item) { return item.status === "l0-rejected"; });
  const l1Rejected = candidates.filter(function (item) { return item.status === "l1-rejected"; });
  const skipped = candidates.filter(function (item) { return item.status === "skipped-budget"; });
  const moderate = published.filter(function (item) { return item.status === "moderate"; });
  const refuted = published.filter(function (item) { return item.status === "refuted"; });
  const uncertain = published.filter(function (item) { return item.status === "uncertain"; });
  const lines = [];
  lines.push("# Rejected and unresolved findings");
  lines.push("");
  lines.push("Commit: " + run.repo.commit + "  |  run-id: " + run.runId);
  lines.push("");
  if (run.mock) {
    lines.push("> **MOCK MODE** - synthetic output, no model was called.");
    lines.push("");
  }
  if (run.mode === "controlled-verifier") {
    lines.push("> **CONTROLLED VERIFIER TEST** - candidates were injected directly into the verifier; they are not scanner output.");
    lines.push("");
  }
  lines.push("This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.");
  lines.push("");
  lines.push("## Rejected at L0 (candidate format)");
  lines.push("");
  if (l0Rejected.length === 0) lines.push("_None this run._");
  for (const item of l0Rejected) {
    lines.push("### Candidate " + item.index + (item.candidate && item.candidate.id ? " - " + item.candidate.id : ""));
    lines.push("");
    lines.push("**Reason:** " + item.l0.reasons.join("; "));
    lines.push("");
  }
  lines.push("## Rejected at L1 (citation check)");
  lines.push("");
  if (l1Rejected.length === 0) lines.push("_None this run._");
  for (const item of l1Rejected) {
    const finding = item.candidate;
    lines.push("### " + finding.id + " - " + finding.title);
    lines.push("");
    lines.push("**Claim:** " + finding.claim);
    lines.push("");
    lines.push("**Reason:** " + item.l1.reason);
    lines.push("");
  }
  lines.push("## Moderate confidence (weak refutation)");
  lines.push("");
  if (moderate.length === 0) lines.push("_None this run._");
  for (const item of moderate) {
    const finding = item.finding;
    lines.push("### " + finding.id + " - " + finding.title);
    lines.push("");
    lines.push("**Claim:** " + finding.claim);
    lines.push("");
    lines.push("**Verifier (" + item.verifier.model + "):** refute/" + item.verifier.mode + " - " + item.verifier.reason);
    lines.push("");
  }
  lines.push("## Skipped (budget)");
  lines.push("");
  if (skipped.length === 0) lines.push("_None this run._");
  for (const item of skipped) {
    lines.push("### " + item.candidate.id + " - " + item.candidate.title);
    lines.push("");
    lines.push("**Claim:** " + item.candidate.claim);
    lines.push("");
  }
  lines.push("");
  lines.push("## Refuted");
  lines.push("");
  if (refuted.length === 0) lines.push("_None this run._");
  for (const item of refuted) {
    const finding = item.finding;
    lines.push("### " + finding.id + " - " + finding.title);
    lines.push("");
    lines.push("**Claim:** " + finding.claim);
    lines.push("");
    lines.push("**Verifier (" + item.verifier.model + "):** refute/" + item.verifier.mode + " - " + item.verifier.reason);
    lines.push("");
    if (Array.isArray(item.verifier.counterEvidence)) {
      for (const evidence of item.verifier.counterEvidence) {
        lines.push("**Counter-citation:** " + evidence.path + ":" + evidence.startLine + "-" + evidence.endLine + " (machine-checked)");
        lines.push(fence() + "text");
        lines.push(evidence.snippet);
        lines.push(fence());
      }
    }
    lines.push("");
  }
  lines.push("## Uncertain");
  lines.push("");
  if (uncertain.length === 0) lines.push("_None this run._");
  for (const item of uncertain) {
    const finding = item.finding;
    lines.push("### " + finding.id + " - " + finding.title);
    lines.push("");
    lines.push("**Claim:** " + finding.claim);
    lines.push("");
    lines.push("**Verifier:** uncertain - " + item.verifier.reason);
    lines.push("");
  }
  return lines.join("\n");
}
