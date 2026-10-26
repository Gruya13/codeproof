function fence() {
  return "```";
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

function citationBlock(finding) {
  const lines = [];
  for (const evidence of finding.evidence) {
    lines.push("**Citation:** " + evidence.path + ":" + evidence.startLine + "-" + evidence.endLine);
    lines.push(fence() + "text");
    lines.push(evidence.snippet);
    lines.push(fence());
  }
  return lines;
}

export function buildReport(options) {
  const repo = options.repo;
  const published = options.published;
  const run = options.run;
  const verified = published.filter(function (item) { return item.status === "verified"; });
  const moderate = published.filter(function (item) { return item.status === "moderate"; });
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
  lines.push("**Publishing rule:** a finding appears under *Verified findings* only if the deterministic citation gate (L1) passed and the adversarial verifier confirmed it. Refuted, uncertain and moderate findings are kept in separate sections - nothing is hidden, and nothing unproven is presented as verified.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push("| Files / LOC | " + repo.files.length + " / " + repo.loc + " |");
  lines.push("| Import edges / cycles | " + repo.edges.length + " / " + repo.cycles.length + " |");
  lines.push("| Findings proposed | " + run.findings.proposed + " |");
  lines.push("| Rejected at L1 (bad citation) | " + run.findings.l1Rejected + " |");
  lines.push("| Verified | " + run.findings.verified + " |");
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
    const citation = citationBlock(finding);
    lines.push(citation.join("\n"));
    lines.push("");
    lines.push("**Verifier (" + item.verifier.model + "):** " + item.verifier.verdict + " - " + item.verifier.reason);
    lines.push("");
  }
  if (moderate.length > 0) {
    lines.push("## Moderate confidence");
    lines.push("");
    lines.push("The verifier tried to refute these with reasoning only, without a mechanically checked counter-citation. They are shown, but they are not counted as verified.");
    lines.push("");
    for (const item of moderate) {
      const finding = item.finding;
      lines.push("### " + finding.id + " - " + finding.title);
      lines.push("");
      lines.push("**Claim:** " + finding.claim);
      lines.push("");
      lines.push("**Verifier (" + item.verifier.model + "):** refute/" + item.verifier.mode + " - " + item.verifier.reason);
      lines.push("");
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
  lines.push("- Static analysis only: the analyzed code is never executed.");
  lines.push("- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.");
  lines.push("- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.");
  lines.push("- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.");
  lines.push("");
  return lines.join("\n");
}

export function buildRejected(options) {
  const published = options.published;
  const run = options.run;
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
  lines.push("This file exists on purpose: the product is not 'we found everything', it is 'we do not publish what we could not prove'. Rejected findings stay visible with the evidence that refuted them.");
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
