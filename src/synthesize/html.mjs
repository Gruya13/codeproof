// Per-run HTML report (paket F). One self-contained file written next to REPORT.md.
// Design contract agreed with agy + codex: static HTML5 with inline CSS and <details>; no
// JavaScript, no network, no embedded raw JSON; every dynamic value is escaped; no millisecond
// timings, so the same inputs produce byte-identical output; links use fixed local names only.
//
// The page is a view of the recorded evidence. It does not re-run anything and it does not claim
// more than the artifacts: verified = L1 + L2, execution-proven = L3, patch-proven = L4.

const LF = String.fromCharCode(10);

function esc(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function details(summary, inner, open) {
  return "<details" + (open ? " open" : "") + "><summary>" + esc(summary) + "</summary>" + inner + "</details>";
}

function codeBlock(text) {
  return "<pre><code>" + esc(text) + "</code></pre>";
}

const STYLE = [
  ":root { color-scheme: dark; --bg: #0f1115; --panel: #171a21; --line: #2a2f3a; --text: #e6e8ee; --muted: #9aa3b2; --ok: #2f9e6f; --warn: #b8862f; --bad: #b04a4a; --blue: #3b6ea5; }",
  "body { margin: 0; padding: 24px; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }",
  "h1 { font-size: 22px; margin: 0 0 4px; }",
  "h2 { font-size: 18px; margin: 28px 0 10px; }",
  "h3 { font-size: 16px; margin: 0 0 6px; }",
  ".meta, .muted { color: var(--muted); font-size: 13px; }",
  ".panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; margin: 14px 0; }",
  "table { border-collapse: collapse; width: 100%; }",
  "td, th { text-align: left; padding: 3px 10px 3px 0; border-bottom: 1px solid var(--line); font-size: 14px; }",
  ".funnel { display: flex; gap: 10px; flex-wrap: wrap; }",
  ".step { background: #11151c; border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; min-width: 120px; }",
  ".step .n { font-size: 22px; font-weight: 700; }",
  ".finding { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; margin: 12px 0; }",
  ".badge { display: inline-block; border-radius: 4px; padding: 1px 8px; font-size: 12px; margin: 0 6px 6px 0; border: 1px solid var(--line); }",
  ".badge.ok { border-color: var(--ok); } .badge.warn { border-color: var(--warn); } .badge.bad { border-color: var(--bad); } .badge.info { border-color: var(--blue); }",
  "pre { background: #0b0e13; border: 1px solid var(--line); border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 13px; }",
  "code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
  "details { margin: 8px 0; } summary { cursor: pointer; color: var(--muted); }",
  ".cite { color: var(--muted); font-size: 13px; }",
  "footer { margin-top: 34px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); padding-top: 12px; }",
  "a { color: #8ab4f8; }"
].join(LF);

function badge(text, kind) {
  return "<span class=\"badge " + esc(kind || "") + "\">" + esc(text) + "</span>";
}

function summaryTable(run, published) {
  const findings = run.findings || {};
  const usage = run.usage || {};
  const repo = run.repo || {};
  const rows = [];
  const row = function (label, value) { rows.push("<tr><td>" + esc(label) + "</td><td>" + esc(value) + "</td></tr>"); };
  row("Files / LOC", (repo.files || 0) + " / " + (repo.loc || 0));
  if (run.scanCoverage) row("Files in scanner prompt", run.scanCoverage.filesInPrompt + " / " + run.scanCoverage.filesTotal + (run.scanCoverage.truncated ? " (truncated)" : ""));
  row("Findings proposed", String(findings.proposed === undefined ? 0 : findings.proposed));
  row("Rejected at L1 (bad citation)", String(findings.l1Rejected === undefined ? 0 : findings.l1Rejected));
  row("Verified", String(findings.verified === undefined ? 0 : findings.verified));
  row("Execution-proven (L3)", String(published.filter(function (item) { return provenLevel(item) >= 3; }).length));
  row("Patch-proven (L4)", String(published.filter(function (item) { return provenLevel(item) >= 4; }).length));
  row("Moderate / refuted / uncertain", (findings.moderate || 0) + " / " + (findings.refuted || 0) + " / " + (findings.uncertain || 0));
  row("Calls / retries", (run.calls || 0) + " / " + (run.retries || 0));
  row("Tokens in / out", (usage.inputTokens || 0) + " / " + (usage.outputTokens || 0));
  row("Cached input tokens", String(usage.cachedTokens || 0));
  row("Cost", usage.measured ? "$" + Number(usage.costUsd).toFixed(4) : "not measured (mock)");
  return "\u003ctable\u003e" + rows.join("") + "\u003c/table\u003e";
}

function provenLevel(item) {
  if (item.evidenceLevel === "patch-proven" || (item.patch && item.patch.status === "patch-proven")) return 4;
  if (item.evidenceLevel === "execution-proven") return 3;
  return 0;
}

function funnel(run, published) {
  const findings = run.findings || {};
  const execution = published.filter(function (item) { return provenLevel(item) >= 3; }).length;
  const patch = published.filter(function (item) { return provenLevel(item) >= 4; }).length;
  const steps = [
    ["proposed", findings.proposed || 0],
    ["L1 rejected", findings.l1Rejected || 0],
    ["verified", findings.verified || 0],
    ["execution-proven", execution],
    ["patch-proven", patch]
  ];
  const parts = steps.map(function (pair) {
    return "<div class=\"step\"><div class=\"n\">" + esc(pair[1]) + "</div><div class=\"muted\">" + esc(pair[0]) + "</div></div>";
  });
  return "<div class=\"funnel\">" + parts.join("") + "</div>";
}

function evidenceBlock(finding) {
  const parts = [];
  const list = Array.isArray(finding.evidence) ? finding.evidence : [];
  for (const evidence of list) {
    parts.push("<p class=\"cite\">" + esc(evidence.path) + ":" + esc(evidence.startLine) + "-" + esc(evidence.endLine) + "</p>");
    if (evidence.snippet) parts.push(codeBlock(evidence.snippet));
  }
  return parts.join("");
}

function reproBlock(item) {
  const repro = item.repro;
  if (!repro) return "<p class=\"muted\">L3 not run for this finding.</p>";
  const parts = [];
  parts.push(badge("repro " + (repro.status || "unknown"), repro.status === "reproduced" ? "ok" : "warn"));
  if (repro.attemptCount) parts.push(badge((repro.attemptCount || 0) + " runs", "info"));
  if (repro.reason) parts.push("<p class=\"muted\">" + esc(repro.reason) + "</p>");
  if (repro.controlCode) parts.push(details("[CONTROL] code (must pass)", codeBlock(repro.controlCode)));
  if (repro.testCode) parts.push(details("[TRIGGER] code (must fail on the analyzed commit)", codeBlock(repro.testCode)));
  return parts.join("");
}

function linkcheckBlock(item) {
  const linkcheck = item.repro && item.repro.linkcheck;
  if (!linkcheck) return "";
  const method = linkcheck.method === "file" ? " (file coverage)" : linkcheck.method === "symbol" ? " (symbol)" : "";
  const kind = linkcheck.status === "proven" ? "ok" : "warn";
  return badge("linkcheck " + (linkcheck.status || "unknown") + method, kind) +
    (linkcheck.detail ? "<p class=\"muted\">" + esc(linkcheck.detail) + "</p>" : "");
}

function patchBlock(item) {
  const patch = item.patch;
  if (!patch) return "";
  const parts = [];
  parts.push(badge("patch " + (patch.status || "unknown"), patch.status === "patch-proven" ? "ok" : "warn"));
  if (patch.targetFile) parts.push("<p class=\"cite\">target: " + esc(patch.targetFile) + "</p>");
  if (patch.reason) parts.push("<p class=\"muted\">" + esc(patch.reason) + "</p>");
  if (patch.searchBlock) parts.push(details("searchBlock", codeBlock(patch.searchBlock)));
  if (patch.replaceBlock) parts.push(details("replaceBlock", codeBlock(patch.replaceBlock)));
  if (patch.diff) parts.push(details("patch diff", codeBlock(patch.diff)));
  return parts.join("");
}

function findingCard(item) {
  const finding = item.finding || {};
  const parts = [];
  parts.push("<article class=\"finding\">");
  parts.push("<h3>" + esc(finding.id) + " - " + esc(finding.severity) + " - " + esc(finding.title) + "</h3>");
  parts.push(badge(item.status + " / " + (item.evidenceLevel || "no level"), item.status === "verified" ? "ok" : "warn"));
  parts.push("<p><strong>Claim:</strong> " + esc(finding.claim) + "</p>");
  parts.push(evidenceBlock(finding));
  if (item.verifier) {
    parts.push("<p class=\"cite\">verifier " + esc(item.verifier.model) + ": " + esc(item.verifier.verdict) + " - " + esc(item.verifier.reason) + "</p>");
    if (item.verifier.counterEvidence) parts.push(details("counter-citation (rejected by L1 policy)", codeBlock(JSON.stringify(item.verifier.counterEvidence, null, 2))));
  }
  parts.push(reproBlock(item));
  parts.push(linkcheckBlock(item));
  parts.push(patchBlock(item));
  parts.push("</article>");
  return parts.join("");
}

function otherFindings(publishedFiltered, candidates) {
  const parts = [];
  parts.push("<details><summary>Other published findings: " + publishedFiltered.length + " (refuted / moderate / uncertain)</summary>");
  for (const item of publishedFiltered) {
    const finding = item.finding || {};
    parts.push("<div class=\"panel\"><h3>" + esc(finding.id) + " - " + esc(finding.title) + "</h3>" + badge(item.status, "warn") + "<p><strong>Claim:</strong> " + esc(finding.claim) + "</p>");
    if (item.verifier) parts.push("<p class=\"cite\">verifier: " + esc(item.verifier.verdict) + " - " + esc(item.verifier.reason) + "</p>");
    parts.push("</div>");
  }
  parts.push("</details>");
  const rejected = Array.isArray(candidates) ? candidates.filter(function (item) { return item.status !== "verified"; }) : [];
  parts.push("<details><summary>Rejected candidates (audit trail): " + rejected.length + "</summary>");
  for (const item of rejected) {
    const candidate = item.candidate || {};
    const reason = (item.l0 && item.l0.reasons ? item.l0.reasons.join("; ") : "") || (item.l1 && item.l1.reason ? item.l1.reason : "") || "";
    parts.push("<p class=\"cite\">" + esc(candidate.id || "(no id)") + " - " + esc(item.status) + (item.proposedBy ? " - by " + esc(item.proposedBy) : "") + (reason ? " - " + esc(reason) : "") + "</p>");
  }
  parts.push("</details>");
  return parts.join("");
}

export function buildHtmlReport(options) {
  const run = options && options.run ? options.run : {};
  const published = options && Array.isArray(options.published) ? options.published : [];
  const candidates = options && Array.isArray(options.candidates) ? options.candidates
    : (options && options.candidates && Array.isArray(options.candidates.candidates) ? options.candidates.candidates : []);
  const verified = published.filter(function (item) { return item.status === "verified"; });
  const others = published.filter(function (item) { return item.status !== "verified"; });
  const repo = run.repo || {};
  const findings = run.findings || {};
  const lines = [];
  lines.push("<!DOCTYPE html>");
  lines.push("<html lang=\"en\">");
  lines.push("<head>");
  lines.push("<meta charset=\"utf-8\">");
  lines.push("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
  lines.push("<title>CodeProof report - " + esc(run.runId || "run") + "</title>");
  lines.push("<style>" + STYLE + "</style>");
  lines.push("</head>");
  lines.push("<body>");
  lines.push("<h1>CodeProof report</h1>");
  lines.push("<p class=\"meta\">run-id: " + esc(run.runId) + " | mode: " + esc(run.mode) + " | commit: " + esc(repo.commit || "worktree") + " | config: " + esc(run.configSha256 || "?") + "</p>");
  lines.push("<p class=\"meta\">models: " + esc((run.models || []).map(function (model) { return model.role + "=" + model.id; }).join(", ")) + " | codeproof " + esc((run.versions || {}).codeproof || "?") + " | node " + esc((run.versions || {}).node || "?") + "</p>");
  if (run.mock) lines.push("<p class=\"panel\"><strong>MOCK MODE</strong> - the mock adapter ran the local pipeline. No model was called and no network was used.</p>");
  if (run.mode === "controlled-verifier") lines.push("<p class=\"panel\"><strong>CONTROLLED VERIFIER TEST</strong> - the candidates were injected directly into the verifier; this is not scanner output.</p>");
  lines.push("<h2>Evidence funnel</h2>");
  lines.push("<div class=\"panel\">" + funnel(run, published) + "</div>");
  lines.push("<h2>Summary</h2>");
  lines.push("<div class=\"panel\">" + summaryTable(run, published) + "</div>");
  lines.push("<h2>Verified findings</h2>");
  if (verified.length === 0) lines.push("<p class=\"muted\">None this run.</p>");
  for (const item of verified) lines.push(findingCard(item));
  lines.push("<h2>Rejected and unresolved</h2>");
  lines.push(otherFindings(others, candidates));
  lines.push("<footer>");
  lines.push("<p>This page is a static view of the recorded evidence; it re-runs nothing. Levels: citation-proven = L1 (provenance, not a semantic judge); verified = L1 + L2 (a model judgment); execution-proven = L3 (two-phase reproducer + LinkCheck under the Node permission model); patch-proven = L4 (differential result on a copy of the snapshot, not a root-cause fix; the repository's own test suite is never run). Offline replay verifies the artifacts and mechanical gates; it does not re-execute the semantic L2 verdict.</p>");
  lines.push("<p>Artifacts: <a href=\"./findings.json\">findings.json</a> | <a href=\"./rejected.md\">rejected.md</a> | <a href=\"./REPORT.md\">REPORT.md</a> | <a href=\"./run.json\">run.json</a>. Every artifact of this run, including this file, is hashed in <code>run.json.attestation</code>.</p>");
  lines.push("<p>Findings proposed: " + esc(findings.proposed || 0) + " | verified: " + esc(findings.verified || 0) + " | execution-proven: " + esc(published.filter(function (item) { return provenLevel(item) >= 3; }).length) + " | patch-proven: " + esc(published.filter(function (item) { return provenLevel(item) >= 4; }).length) + "</p>");
  lines.push("</footer>");
  lines.push("</body>");
  lines.push("</html>");
  return lines.join(LF) + LF;
}
