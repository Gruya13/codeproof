import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildVerifierContext } from "../src/verify/context.mjs";

function write(dir, relativePath, lines) {
  const full = join(dir, relativePath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, lines.join("\n"));
}

const finding = {
  id: "F-001",
  claim: "value.length can throw on a missing value",
  evidence: [{ path: "src/a.ts", startLine: 4, endLine: 6, snippet: "export function b(value: string) {\n  return value.length;\n}" }]
};

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "codeproof-ctx-"));
  write(root, "src/a.ts", [
    "export function a() {",
    "  return 1;",
    "}",
    "export function b(value: string) {",
    "  return value.length;",
    "}"
  ]);
  write(root, "src/b.ts", ["import { a } from \"./a.ts\";", "export const b = () => a();"]);
  const big = [];
  for (let index = 1; index <= 500; index += 1) big.push("export const value" + index + " = " + index + ";");
  write(root, "src/c.ts", big);
  return {
    root: root,
    files: [
      { path: "src/a.ts", loc: 6 },
      { path: "src/b.ts", loc: 2 },
      { path: "src/c.ts", loc: 500 }
    ],
    edges: [{ from: "src/b.ts", to: "src/a.ts" }],
    cycles: [],
    loc: 508
  };
}

test("context includes the cited file with line numbers and its import neighbor", function () {
  const ctx = buildVerifierContext({ repo: makeRepo(), finding: finding, maxChars: 6000 });
  assert.match(ctx.text, /### src\/a\.ts - cited file/);
  assert.match(ctx.text, /4 \| export function b/);
  assert.match(ctx.text, /### src\/b\.ts - imports cited file/);
  assert.match(ctx.text, /Repository digest/);
  assert.match(ctx.text, /Context is bounded/);
  assert.ok(ctx.text.length <= 6600, "context length was " + ctx.text.length);
});

test("context stays bounded and excludes an unrelated large file", function () {
  const ctx = buildVerifierContext({ repo: makeRepo(), finding: finding, maxChars: 3000 });
  assert.ok(!ctx.included.includes("src/c.ts"));
  assert.ok(ctx.text.length <= 3400);
});

test("a long cited file is windowed around the citation", function () {
  const root = mkdtempSync(join(tmpdir(), "codeproof-ctx-long-"));
  const lines = [];
  for (let index = 1; index <= 600; index += 1) lines.push("export const line" + index + " = " + index + ";");
  write(root, "src/long.ts", lines);
  const repo = { root: root, files: [{ path: "src/long.ts", loc: 600 }], edges: [], cycles: [], loc: 600 };
  const longFinding = {
    id: "F-002",
    claim: "line400 is wrong",
    evidence: [{ path: "src/long.ts", startLine: 400, endLine: 401, snippet: "export const line400 = 400;" }]
  };
  const ctx = buildVerifierContext({ repo: repo, finding: longFinding, maxChars: 12000 });
  assert.match(ctx.text, /lines 340-461 of 600/);
  assert.match(ctx.text, /400 \| export const line400/);
  assert.ok(!ctx.text.includes("line1 ="));
});
