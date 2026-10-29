// Dual-scanner merge: two models scan the same repository with the same prompt.
// Their candidates are merged into one list, with duplicate findings collapsed and every
// finding tagged with the model(s) that proposed it.
//
// Dedup requires overlapping citations AND similar claims. Keeping uncertain matches separate
// avoids silently dropping a different defect on the same line; duplicates remain in the audit.

function overlaps(left, right) {
  return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

// Light-weight English stemmer: enough to treat inflections of the same word as equal
// ("mutates" / "mutating" / "mutated" -> "mutat") without adding a dependency. It intentionally
// under-stems rare forms; the merged result stays conservative because the Jaccard threshold is 0.5.
function stemToken(token) {
  let word = token;
  const suffixes = ["ational", "ations", "ation", "ingly", "ings", "ing", "edly", "ed", "ies", "ied", "ly", "es", "s"];
  if (word.length > 4) {
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
        word = word.slice(0, -suffix.length);
        break;
      }
    }
  }
  if (word.length > 3 && word.endsWith("e")) word = word.slice(0, -1);
  return word;
}

function claimTokens(finding) {
  // Use both fields, but discard generated ids and generic "Finding" titles.
  const statement = (String(finding.claim || "") + " " + String(finding.title || "")).toLowerCase();
  const tokens = new Set();
  for (const token of (statement.match(/[a-z0-9_$]+/g) || [])) {
    if (token.length <= 2 || /^\d+$|^f\d+$/.test(token)) continue;
    if (["the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "finding"].includes(token)) continue;
    tokens.add(stemToken(token));
  }
  return tokens;
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

// Compare every evidence entry of both findings: one scanner may put the function definition first
// and the cited defect second, while the other cites the defect line directly.
function evidencePairsOverlap(left, right) {
  const firstList = left && Array.isArray(left.evidence) ? left.evidence : [];
  const secondList = right && Array.isArray(right.evidence) ? right.evidence : [];
  for (const first of firstList) {
    if (!first || typeof first.path !== "string") continue;
    for (const second of secondList) {
      if (!second || typeof second.path !== "string") continue;
      if (first.path === second.path && overlaps(first, second)) return true;
    }
  }
  return false;
}

export function sameFinding(left, right) {
  return similarClaim(left, right) && evidencePairsOverlap(left, right);
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