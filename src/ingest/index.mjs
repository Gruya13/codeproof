import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname, posix } from "node:path";
import { sha256Hex } from "../run/index.mjs";

const ANALYZABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir, root, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, out);
    } else if (ANALYZABLE.has(extname(entry.name))) {
      out.push(relative(root, full).split("\\").join("/"));
    }
  }
  return out;
}

const IMPORT_RE = /(?:import\s+(?:[^"'()]*?\s+from\s+)?|export\s+(?:[^"'()]*?\s+)?from\s+|require\s*\(\s*)["']([^"']+)["']/g;

function extractSpecifiers(source) {
  const out = [];
  IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = IMPORT_RE.exec(source)) !== null) out.push(match[1]);
  return out;
}

function resolveSpecifier(fromRel, spec, fileSet) {
  if (!spec.startsWith(".")) return null;
  const base = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  const extension = posix.extname(base);
  const stem = extension ? base.slice(0, -extension.length) : base;
  const candidates = [base];
  if (extension === ".js") candidates.push(stem + ".ts", stem + ".tsx");
  if (extension === ".jsx") candidates.push(stem + ".tsx");
  if (!extension) {
    candidates.push(base + ".ts", base + ".tsx", base + ".js", base + ".jsx", base + ".mjs", base + ".cjs");
  }
  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function findCycles(nodes, edges) {
  const adjacency = new Map();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) adjacency.get(edge.from).push(edge.to);
  const state = new Map();
  const stack = [];
  const cycles = [];
  const seen = new Set();
  function visit(node) {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node)) {
      const nextState = state.get(next) || 0;
      if (nextState === 1) {
        const index = stack.lastIndexOf(next);
        const cycle = stack.slice(index).concat(next);
        const key = cycle.slice(0, -1).slice().sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (nextState === 0) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  }
  for (const node of nodes) {
    if ((state.get(node) || 0) === 0) visit(node);
  }
  return cycles;
}

export function ingest(rootPath) {
  const files = walk(rootPath, rootPath, []).sort();
  if (files.length === 0) throw new Error("no TS/JS files found under " + rootPath);
  const fileSet = new Set(files);
  const entries = [];
  const sourceByRel = new Map();
  for (const rel of files) {
    const source = readFileSync(join(rootPath, rel), "utf8");
    sourceByRel.set(rel, source);
    const lineCount = source.split("\n").length - (source.endsWith("\n") ? 1 : 0);
    entries.push({ path: rel, loc: lineCount, sha256: sha256Hex(source) });
  }
  const edges = [];
  for (const rel of files) {
    for (const spec of extractSpecifiers(sourceByRel.get(rel))) {
      const target = resolveSpecifier(rel, spec, fileSet);
      if (target && target !== rel) edges.push({ from: rel, to: target, specifier: spec });
    }
  }
  const nodes = files.slice();
  const cycles = findCycles(nodes, edges);
  const loc = entries.reduce(function (sum, entry) { return sum + entry.loc; }, 0);
  return { root: rootPath, files: entries, edges: edges, cycles: cycles, loc: loc };
}

export function repoDigest(result) {
  const lines = [
    "Repo digest",
    "files: " + result.files.length,
    "loc: " + result.loc,
    "imports: " + result.edges.length,
    "cycles: " + result.cycles.length,
    "",
    "files:"
  ];
  for (const file of result.files) lines.push("- " + file.path + " (" + file.loc + " lines)");
  lines.push("", "imports:");
  for (const edge of result.edges) lines.push("- " + edge.from + " -> " + edge.to);
  if (result.cycles.length > 0) {
    lines.push("", "cycles:");
    for (const cycle of result.cycles) lines.push("- " + cycle.join(" -> "));
  }
  return lines.join("\n");
}

export function filesWithLineNumbers(result, maxChars) {
  const limit = maxChars || 400000;
  const parts = [];
  let used = 0;
  for (const file of result.files) {
    const source = readFileSync(join(result.root, file.path), "utf8");
    const numbered = source.split("\n").map(function (line, index) {
      return String(index + 1) + " | " + line;
    }).join("\n");
    const block = "### " + file.path + " (" + file.loc + " lines)\n" + numbered;
    if (used + block.length > limit) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n");
}
