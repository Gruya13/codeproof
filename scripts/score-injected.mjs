#!/usr/bin/env node
// Score an injected-repository run against its ground truth.
// Matching: the finding evidence must point at the expected file and overlap the
// expected line range extended by +/- toleranceLines (default 2).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function parseArgs(argv) {
  const options = { expected: null, run: null, findings: null, json: null, toleranceLines: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--expected") options.expected = take();
    else if (arg === "--run") options.run = take();
    else if (arg === "--findings") options.findings = take();
    else if (arg === "--json") options.json = take();
    else if (arg === "--tolerance") options.toleranceLines = Number(take());
    else throw new Error("unknown option: " + arg);
  }
  if (!options.expected || (!options.run && !options.findings)) {
    throw new Error("usage: node scripts/score-injected.mjs --expected <expected.json> --run <runDir> [--json <out>]");
  }
  return options;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const expected = JSON.parse(readFileSync(options.expected, "utf8"));
  const tolerance = options.toleranceLines === null ? (expected.toleranceLines === undefined ? 2 : expected.toleranceLines) : options.toleranceLines;
  const runDir = options.run ? resolve(options.run) : null;
  let findingsPath = options.findings;
  if (!findingsPath && runDir) {
    const last = runDir;
    findingsPath = existsSync(join(last, "findings.json")) ? join(last, "findings.json") : null;
  }
  if (!findingsPath) throw new Error("findings.json not found; point --run at a run directory (or pass --findings)");
  const published = JSON.parse(readFileSync(findingsPath, "utf8"));
  let candidates = null;
  const candidatesPath = join(findingsPath, "..", "candidates.json");
  if (existsSync(candidatesPath)) candidates = JSON.parse(readFileSync(candidatesPath, "utf8"));

  const defects = expected.defects.map(function (defect) {
    return {
      id: defect.id,
      file: defect.file,
      startLine: defect.startLine,
      endLine: defect.endLine,
      statement: defect.statement,
      found: false,
      statuses: [],
      matches: []
    };
  });

  const traps = (expected.traps || []).map(function (trap) {
    return { id: trap.id, file: trap.file, startLine: trap.startLine, endLine: trap.endLine, hit: false, verified: false, reason: trap.reason };
  });
  const extraTrue = (expected.extraTrue || []).map(function (extra) {
    return { id: extra.id, file: extra.file, startLine: extra.startLine, endLine: extra.endLine, seen: false };
  });

  const falsePositives = [];
  for (const item of published) {
    const finding = item.finding || {};
    const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
    const matched = [];
    for (const defekt of defects) {
      for (const citation of evidence) {
        if (citation.path !== defekt.file) continue;
        const start = defekt.startLine - tolerance;
        const end = defekt.endLine + tolerance;
        if (!overlaps(citation.startLine, citation.endLine, start, end)) continue;
        if (!matched.includes(defekt)) matched.push(defekt);
        if (!defekt.statuses.includes(item.status)) defekt.statuses.push(item.status);
      }
    }
    // A finding can also land on a registered trap (a place that looks wrong but is correct)
    // or on a pre-registered real defect; neither counts as a false positive.
    let trapHit = null;
    for (const trap of traps) {
      if (evidence.some(function (citation) {
        return citation.path === trap.file && overlaps(citation.startLine, citation.endLine, trap.startLine - tolerance, trap.endLine + tolerance);
      })) { trapHit = trap; break; }
    }
    let extraHit = null;
    for (const extra of extraTrue) {
      if (evidence.some(function (citation) {
        return citation.path === extra.file && overlaps(citation.startLine, citation.endLine, extra.startLine - tolerance, extra.endLine + tolerance);
      })) { extraHit = extra; break; }
    }
    if (trapHit) {
      trapHit.hit = true;
      if (item.status === "verified") trapHit.verified = true;
      falsePositives.push({
        id: finding.id,
        title: finding.title,
        status: item.status,
        path: evidence.length ? evidence[0].path : null,
        startLine: evidence.length ? evidence[0].startLine : null,
        trap: true,
        trapId: trapHit.id
      });
      continue;
    }
    if (extraHit) {
      extraHit.seen = true;
      continue;
    }
    if (matched.length === 0) {
      falsePositives.push({
        id: finding.id,
        title: finding.title,
        status: item.status,
        path: evidence.length ? evidence[0].path : null,
        startLine: evidence.length ? evidence[0].startLine : null
      });
      continue;
    }
    for (const defekt of matched) {
      defekt.found = true;
      defekt.matches.push({
        findingId: finding.id,
        status: item.status,
        path: evidence[0].path,
        startLine: evidence[0].startLine,
        lineDelta: Math.min.apply(null, evidence.map(function (citation) { return Math.abs(citation.startLine - defekt.startLine); }))
      });
    }
  }

  let l1Checked = 0;
  let l1Passed = 0;
  let l0Rejected = 0;
  if (candidates && Array.isArray(candidates.candidates)) {
    for (const entry of candidates.candidates) {
      if (!entry.l0 || !entry.l0.ok) { l0Rejected += 1; continue; }
      l1Checked += 1;
      if (entry.l1 && entry.l1.passed) l1Passed += 1;
    }
  }
  const verified = published.filter(function (item) { return item.status === "verified"; });
  const verifiedDefects = defects.filter(function (defect) {
    return defect.matches.some(function (match) { return match.status === "verified"; });
  });
  const verifiedFp = falsePositives.filter(function (item) { return item.status === "verified"; });
  const metrics = {
    defectsTotal: defects.length,
    defectsFoundAny: defects.filter(function (defect) { return defect.found; }).length,
    defectsVerified: verifiedDefects.length,
    recallAny: defects.length > 0 ? defects.filter(function (defect) { return defect.found; }).length / defects.length : null,
    recallVerified: defects.length > 0 ? verifiedDefects.length / defects.length : null,
    verifiedPublished: verified.length,
    verifiedFalsePositives: verifiedFp.length,
    trapsTotal: traps.length,
    trapsVerified: traps.filter(function (trap) { return trap.verified; }).length,
    trapsHitAny: traps.filter(function (trap) { return trap.hit; }).length,
    extraTrueSeen: extraTrue.filter(function (extra) { return extra.seen; }).map(function (extra) { return extra.id; }),
    precisionVerified: verified.length > 0 ? (verified.length - verifiedFp.length) / verified.length : null,
    defects: defects.map(function (defect) { return { id: defect.id, file: defect.file, found: defect.found, statuses: defect.statuses }; }),
    traps: traps.map(function (trap) { return { id: trap.id, file: trap.file, hit: trap.hit, verified: trap.verified, reason: trap.reason }; }),
    l1Checked: l1Checked,
    l1Passed: l1Passed,
    l1PassRate: l1Checked > 0 ? l1Passed / l1Checked : null,
    l0Rejected: l0Rejected,
    toleranceLines: tolerance,
    expected: defects.map(function (defect) {
      return {
        id: defect.id, file: defect.file, startLine: defect.startLine, endLine: defect.endLine,
        found: defect.found, statuses: defect.statuses, matches: defect.matches, statement: defect.statement
      };
    }),
    falsePositives: falsePositives
  };
  const outPath = options.json ? resolve(options.json) : join(findingsPath, "..", "score.json");
  writeFileSync(outPath, JSON.stringify(metrics, null, 2) + "\n");

  const pct = function (value) { return value === null ? "n/a" : Math.round(value * 1000) / 10 + "%"; };
  console.log("# Injected-defect score");
  console.log("");
  console.log("Run: " + findingsPath + " | n = " + defects.length + " injected defects | tolerance +/-" + tolerance + " lines");
  console.log("");
  console.log("| Metric | Value |");
  console.log("|---|---|");
  console.log("| Defects found (any status) | " + metrics.defectsFoundAny + "/" + defects.length + " (" + pct(metrics.recallAny) + ") |");
  console.log("| Defects verified | " + metrics.defectsVerified + "/" + defects.length + " (" + pct(metrics.recallVerified) + ") |");
  console.log("| Verified findings published | " + verified.length + " |");
  console.log("| Verified false positives | " + verifiedFp.length + " |");
  console.log("| Precision (verified-only) | " + pct(metrics.precisionVerified) + " |");
  if (traps.length > 0) {
    console.log("| Traps verified (leaked) | " + metrics.trapsVerified + "/" + traps.length + " |");
    console.log("| Traps cited at any status | " + metrics.trapsHitAny + "/" + traps.length + " |");
  }
  if (extraTrue.length > 0) console.log("| Pre-registered real defects seen | " + metrics.extraTrueSeen.join(", ") + " |");
  console.log("| L1 pass rate | " + pct(metrics.l1PassRate) + " (" + l1Passed + "/" + l1Checked + ") |");
  console.log("| L0 rejected candidates | " + l0Rejected + " |");
  console.log("");
  console.log("## Per defect");
  console.log("");
  for (const defect of metrics.expected) {
    const statuses = defect.statuses.length ? defect.statuses.join(", ") : "missed";
    console.log("- " + defect.id + " " + defect.file + ":" + defect.startLine + " -> " + statuses +
      (defect.matches.length ? " (line delta " + defect.matches.map(function (m) { return m.lineDelta; }).join("/") + ")" : ""));
  }
  if (falsePositives.length > 0) {
    console.log("");
    console.log("## False positives");
    for (const fp of falsePositives) console.log("- " + fp.id + " " + fp.status + " " + fp.path + ":" + fp.startLine + " - " + fp.title);
  }
  console.log("");
  console.log("score written to " + outPath);
}

main();
