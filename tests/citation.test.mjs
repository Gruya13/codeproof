import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { checkCitation } from "../src/verify/index.mjs";

const root = fileURLToPath(new URL("../fixtures/mini-repo", import.meta.url));
const repo = {
  root: root,
  manifest: new Map([
    ["src/pagination.js", { path: "src/pagination.js" }],
    ["src/auth.js", { path: "src/auth.js" }],
    ["src/batch.js", { path: "src/batch.js" }]
  ])
};

function freshRepo(extra) {
  const manifest = new Map([
    ["src/pagination.js", { path: "src/pagination.js" }],
    ["src/Case.js", { path: "src/Case.js" }],
    ["src\\win.js", { path: "src\\win.js" }]
  ]);
  return { root: root, manifest: manifest, ...(extra || {}) };
}

test("T-B8: citation paths are case-sensitive, reject backslashes, absolute paths and ..", function () {
  const boundary = { startLine: 3, endLine: 3, snippet: "  return items.slice(start, start + size + 1);" };
  // wrong case against a real manifest entry
  const caseMismatch = checkCitation({ ...boundary, path: "src/PAGINATION.js" }, freshRepo());
  assert.equal(caseMismatch.passed, false);
  assert.match(caseMismatch.reason, /not in the repo manifest/);
  // a Windows separator must never be normalised into a valid repository path
  const windowsPath = checkCitation({ ...boundary, path: "src\\win.js" }, freshRepo());
  assert.equal(windowsPath.passed, false);
  assert.match(windowsPath.reason, /must be relative/);
  // absolute paths and traversal
  for (const badPath of ["/etc/passwd", "src/../pagination.js", "..\\src\\pagination.js"]) {
    const result = checkCitation({ ...boundary, path: badPath }, freshRepo());
    assert.equal(result.passed, false, badPath);
  }
});

test("L1 accepts a citation whose snippet matches the cited lines", function () {
  const result = checkCitation({
    path: "src/pagination.js",
    startLine: 3,
    endLine: 3,
    snippet: "  return items.slice(start, start + size + 1);"
  }, repo);
  assert.equal(result.passed, true, result.reason);
});

test("L1 accepts one-line tolerance in the line number", function () {
  const result = checkCitation({
    path: "src/pagination.js",
    startLine: 4,
    endLine: 4,
    snippet: "  return items.slice(start, start + size + 1);"
  }, repo);
  assert.equal(result.passed, true, result.reason);
});

test("L1 rejects a snippet that does not exist at the cited lines", function () {
  const result = checkCitation({
    path: "src/pagination.js",
    startLine: 3,
    endLine: 3,
    snippet: "  return items.slice(start, end);"
  }, repo);
  assert.equal(result.passed, false);
});

test("L1 rejects citations wider than 15 lines", function () {
  const result = checkCitation({
    path: "src/batch.js",
    startLine: 1,
    endLine: 16,
    snippet: "export async function runAll(items, worker) {"
  }, repo);
  assert.equal(result.passed, false);
});

test("L1 rejects path traversal and unknown paths", function () {
  const traversal = checkCitation({ path: "../package.json", startLine: 1, endLine: 1, snippet: "{" }, repo);
  assert.equal(traversal.passed, false);
  const unknown = checkCitation({ path: "src/missing.js", startLine: 1, endLine: 1, snippet: "x" }, repo);
  assert.equal(unknown.passed, false);
});
