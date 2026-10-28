import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_MAX_CHARS = 24000;
const MAX_FILE_LINES = 220;
const CITED_WINDOW = 60;
const HEADER_LINES = 30;

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "import", "export", "async", "await", "this", "that",
  "with", "from", "true", "false", "null", "undefined", "typeof", "instanceof", "class", "extends",
  "super", "new", "delete", "void", "yield", "default", "case", "switch", "break", "continue", "throw",
  "try", "catch", "finally", "else", "for", "while", "interface", "type", "string", "number", "boolean",
  "object", "any", "unknown", "never", "readonly", "public", "private", "protected", "static", "implements",
  "namespace", "declare", "module", "require", "length", "value", "values", "index", "error", "items",
  "result", "data", "body", "args", "options", "context", "response", "request", "headers", "url"
]);

export function extractIdentifiers(text) {
  const found = new Set();
  const matches = String(text || "").match(/\b[A-Za-z_$][A-Za-z0-9_$]{3,}\b/g) || [];
  for (const match of matches) {
    if (KEYWORDS.has(match)) continue;
    found.add(match);
    if (found.size >= 16) break;
  }
  return [...found];
}

// Prefer the content that was ingested from the analyzed commit: the verifier context and the
// L1 citation check must see the same bytes even when the working tree has uncommitted changes.
function readSource(repo, relativePath) {
  if (repo && repo.sources && repo.sources.has(relativePath)) return repo.sources.get(relativePath);
  try {
    return readFileSync(join(repo.root, relativePath), "utf8");
  } catch (error) {
    return null;
  }
}

function renderFile(file, content, options) {
  const lines = content === null ? [] : content.split("\n");
  let ranges = [{ start: 1, end: Math.min(lines.length || 1, MAX_FILE_LINES) }];
  if (lines.length > MAX_FILE_LINES && options.citedRanges.length > 0) {
    ranges = [{ start: 1, end: HEADER_LINES }].concat(options.citedRanges.map(function (range) {
      return { start: Math.max(1, range[0] - CITED_WINDOW), end: Math.min(lines.length, range[1] + CITED_WINDOW) };
    })).sort(function (a, b) { return a.start - b.start; });
    const merged = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
      else merged.push({ start: range.start, end: range.end });
    }
    ranges = merged;
  }
  const label = options.relation ? " - " + options.relation : "";
  return ranges.map(function (range) {
    const suffix = range.start > 1 || range.end < lines.length
      ? " - lines " + range.start + "-" + range.end + " of " + lines.length
      : " - " + lines.length + " lines";
    const header = "### " + file.path + label + suffix;
    const entries = [];
    for (let index = range.start; index <= range.end && content !== null; index += 1) {
      entries.push({ number: index, text: lines[index - 1] });
    }
    return {
      text: header + "\n" + (content === null ? "(content not readable)" : entries.map(function (entry) { return String(entry.number).padStart(4, " ") + " | " + entry.text; }).join("\n")),
      segment: { path: file.path, startLine: range.start, endLine: range.end, lines: entries }
    };
  });
}

function buildDigest(repo, citedPaths, neighbors) {
  const lines = [
    "## Repository digest",
    "files: " + repo.files.length + " | loc: " + repo.loc + " | import edges: " + (repo.edges ? repo.edges.length : 0) + " | cycles: " + (repo.cycles ? repo.cycles.length : 0),
    "",
    "files:"
  ];
  for (const file of repo.files) {
    const marks = [];
    if (citedPaths.has(file.path)) marks.push("cited");
    if (neighbors.has(file.path)) marks.push(neighbors.get(file.path));
    lines.push("- " + file.path + " (" + file.loc + " lines" + (marks.length ? "; " + marks.join("; ") : "") + ")");
  }
  if (repo.edges && repo.edges.length > 0) {
    lines.push("", "imports:");
    for (const edge of repo.edges.slice(0, 80)) lines.push("- " + edge.from + " -> " + edge.to);
    if (repo.edges.length > 80) lines.push("- ...");
  }
  return lines.join("\n");
}

export function buildVerifierContext(input) {
  const repo = input.repo;
  const finding = input.finding;
  const limit = input.maxChars || DEFAULT_MAX_CHARS;
  const evidences = finding && Array.isArray(finding.evidence) ? finding.evidence : [];
  const citedPaths = new Set(evidences.map(function (item) { return item.path; }));
  const neighbors = new Map();
  for (const edge of repo.edges || []) {
    if (citedPaths.has(edge.from) && !citedPaths.has(edge.to)) neighbors.set(edge.to, "imported by cited file");
    if (citedPaths.has(edge.to) && !citedPaths.has(edge.from)) neighbors.set(edge.from, "imports cited file");
  }
  const identifiers = extractIdentifiers(
    (finding && finding.claim ? finding.claim : "") + " " + evidences.map(function (item) { return item.snippet || ""; }).join(" ")
  );
  const candidates = [];
  for (const file of repo.files) {
    const content = readSource(repo, file.path);
    let score = 0;
    if (citedPaths.has(file.path)) score += 1000;
    if (neighbors.has(file.path)) score += 100;
    if (content) {
      for (const identifier of identifiers) {
        if (content.includes(identifier)) score += 15;
      }
    }
    candidates.push({ file: file, content: content, score: score });
  }
  candidates.sort(function (a, b) {
    return b.score - a.score || a.file.path.localeCompare(b.file.path);
  });
  const parts = [buildDigest(repo, citedPaths, neighbors)];
  let used = parts[0].length;
  const included = [];
  const segments = [];
  let truncated = false;
  for (const candidate of candidates) {
    if (candidate.score === 0 && included.length > 0) break;
    const relation = citedPaths.has(candidate.file.path) ? "cited file" : neighbors.get(candidate.file.path) || null;
    const blocks = renderFile(candidate.file, candidate.content, {
      citedRanges: evidences.filter(function (item) { return item.path === candidate.file.path && Number.isInteger(item.startLine) && Number.isInteger(item.endLine); })
        .map(function (item) { return [item.startLine, item.endLine]; }),
      relation: relation
    });
    for (const block of blocks) {
      if (used + block.text.length + 2 > limit) {
        truncated = true;
        continue;
      }
      parts.push(block.text);
      used += block.text.length + 2;
      segments.push(block.segment);
      if (!included.includes(candidate.file.path)) included.push(candidate.file.path);
    }
  }
  parts.push("Context is bounded to the most relevant files. If a refutation depends on code that is not shown above, return uncertain and state what you would need to see; do not refute because something might be handled elsewhere.");
  return { text: parts.join("\n\n"), segments: segments, included: included, truncated: truncated, chars: used };
}
