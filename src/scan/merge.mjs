// Dual-scanner merge: two models scan the same repository with the same prompt.
// Their candidates are merged into one list, with duplicate findings collapsed and every
// finding tagged with the model(s) that proposed it.
//
// Dedup requires overlapping citations AND similar claims. Keeping uncertain matches separate
// avoids silently dropping a different defect on the same line; duplicates remain in the audit.

function overlaps(left, right) {
  return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

function firstEvidence(finding) {
  return finding && Array.isArray(finding.evidence) && finding.evidence.length > 0 ? finding.evidence[0] : null;
}

function claimTokens(finding) {
  // Use both fields, but discard generated ids and generic "Finding" titles.
  const statement = (String(finding.claim || "") + " " + String(finding.title || "")).toLowerCase();
  return new Set((statement.match(/[a-z0-9_$]+/g) || []).filter(function (token) {
    return token.length > 2 && !/^\d+$|^f\d+$/.test(token) &&
      !["the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "finding"].includes(token);
  }));
}

function similarClaim(left, right) {
  const a = claimTokens(left);
  const b = claimTokens(right);
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  // Jaccard >= 0.5 requires at least half of the distinct substantive words to agree.
  return shared / (a.size + b.size - shared) >= 0.5;
}

export function sameFinding(left, right) {
  const a = firstEvidence(left);
  const b = firstEvidence(right);
  if (!a || !b) return false;
  return a.path === b.path && overlaps(a, b) && similarClaim(left, right);
}

// Input: runs = [{ proposedBy: "spark" | "wonder", findings: [...], rejected: [...] }]
// Output: { candidates: [{ finding, proposedBy: [...], originalIds: [...], auditIndex }], duplicates: [...] }
// The merged candidates get fresh sequential ids (F-001...) so two scanners that both start at
// F-001 do not collide; the original ids stay in the audit trail.
export function mergeScannerRuns(runs) {
  const candidates = [];
  const duplicates = [];
  let nextId = 1;
  for (const run of runs) {
    if (!run || !Array.isArray(run.findings)) continue;
    for (const finding of run.findings) {
      // Only collapse a candidate against one from a DIFFERENT scanner: two distinct findings
      // reported by the same model on the same lines are different claims, not duplicates.
      const existing = candidates.find(function (candidate) {
        return candidate.proposedBy.indexOf(run.proposedBy) === -1 && sameFinding(candidate.finding, finding);
      });
      if (existing) {
        if (existing.proposedBy.indexOf(run.proposedBy) === -1) existing.proposedBy.push(run.proposedBy);
        existing.originalIds.push(finding.id);
        duplicates.push({
          proposedBy: run.proposedBy,
          originalId: finding.id,
          mergedInto: existing.finding.id,
          candidate: finding
        });
        continue;
      }
      const merged = Object.assign({}, finding, { id: "F-" + String(nextId).padStart(3, "0") });
      nextId += 1;
      candidates.push({
        finding: merged,
        proposedBy: [run.proposedBy],
        originalIds: [finding.id],
        auditIndex: null
      });
    }
  }
  return { candidates: candidates, duplicates: duplicates };
}

// The verifier that did not propose the finding tries to refute it (cross-examination by model).
export function verifierRoleFor(proposedBy, options = {}) {
  const primary = options.primary || "spark";
  const secondary = options.secondary || "wonder";
  if (proposedBy.length === 1 && proposedBy[0] === primary) return "verifier";
  if (proposedBy.length === 1 && proposedBy[0] === secondary) return "verifier-secondary";
  return "verifier";
}