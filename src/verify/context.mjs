import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_MAX_CHARS = 24000;
const MAX_FILE_LINES = 220;
const CITED_WINDOW = 60;

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
  const citedLines = options.citedLines;
  const lines = content === null ? [] : content.split("\n");
  let start = 1;
  let end = lines.length || 1;
  if (citedLines && lines.length > MAX_FILE_LINES) {
    start = Math.max(1, citedLines[0] - CITED_WINDOW);
    end = Math.min(lines.length, citedLines[1] + CITED_WINDOW);
  } else if (lines.length > MAX_FILE_LINES) {
    end = MAX_FILE_LINES;
  }
  const label = options.relation ? " - " + options.relation : "";
  const range = start > 1 || end < lines.length
    ? " - lines " + start + "-" + end + " of " + lines.length
    : " - " + lines.length + " lines";
  const header = "### " + file.path + label + range;
  if (content === null) return header + "\n(content not readable)";
  const body = [];
  for (let index = start; index <= end; index += 1) {
    body.push(String(index).padStart(4, " ") + " | " + lines[index - 1]);
  }
  return header + "\n" + body.join("\n");
}

function buildDigest(repo, citedPath, neighbors) {
  const lines = [
    "## Repository digest",
    "files: " + repo.files.length + " | loc: " + repo.loc + " | import edges: " + (repo.edges ? repo.edges.length : 0) + " | cycles: " + (repo.cycles ? repo.cycles.length : 0),
    "",
    "files:"
  ];
  for (const file of repo.files) {
    const marks = [];
    if (file.path === citedPath) marks.push("cited");
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
  const evidence = finding && Array.isArray(finding.evidence) && finding.evidence.length > 0 ? finding.evidence[0] : null;
  const citedPath = evidence ? evidence.path : null;
  const citedLines = evidence && Number.isInteger(evidence.startLine) && Number.isInteger(evidence.endLine)
    ? [evidence.startLine, evidence.endLine]
    : null;
  const neighbors = new Map();
  for (const edge of repo.edges || []) {
    if (!citedPath) break;
    if (edge.from === citedPath && edge.to !== citedPath) neighbors.set(edge.to, "imported by cited file");
    if (edge.to === citedPath && edge.from !== citedPath) neighbors.set(edge.from, "imports cited file");
  }
  const identifiers = extractIdentifiers(
    (finding && finding.claim ? finding.claim : "") + " " + (evidence && evidence.snippet ? evidence.snippet : "")
  );
  const candidates = [];
  for (const file of repo.files) {
    const content = readSource(repo, file.path);
    let score = 0;
    if (file.path === citedPath) score += 1000;
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
  const parts = [buildDigest(repo, citedPath, neighbors)];
  let used = parts[0].length;
  const included = [];
  let truncated = false;
  for (const candidate of candidates) {
    if (candidate.score === 0 && included.length > 0) break;
    const relation = candidate.file.path === citedPath ? "cited file" : neighbors.get(candidate.file.path) || null;
    const block = renderFile(candidate.file, candidate.content, {
      citedLines: candidate.file.path === citedPath ? citedLines : null,
      relation: relation
    });
    if (used + block.length + 2 > limit) {
      truncated = true;
      if (candidate.file.path === citedPath && limit - used > 2000) {
        parts.push(block.slice(0, limit - used - 200));
        included.push(candidate.file.path);
        used = limit;
      }
      continue;
    }
    parts.push(block);
    used += block.length + 2;
    included.push(candidate.file.path);
  }
  parts.push("Context is bounded to the most relevant files. If a refutation depends on code that is not shown above, return uncertain and state what you would need to see; do not refute because something might be handled elsewhere.");
  return { text: parts.join("\n\n"), included: included, truncated: truncated, chars: used };
}
