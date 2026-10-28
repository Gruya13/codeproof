import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPatchMessages, PATCH_SYSTEM_PROMPT } from "../src/patch/index.mjs";
import { runLinkCheck } from "../src/repro/linkcheck.mjs";
import { buildScannerInput, ingest } from "../src/ingest/index.mjs";
import { replayRun } from "../src/run/replay.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(repoRoot, "src/cli.mjs");
const nodeMajor = Number(process.versions.node.split(".")[0]);

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-hardening-c-"));
  t.after(function () { rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

function writeFiles(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
}

function snapshotWith(t, files) {
  const dir = tempDir(t);
  const snapshot = join(dir, "snapshot");
  mkdirSync(snapshot);
  writeFiles(snapshot, files);
  return snapshot;
}

// Node 22 has no --allow-inspector: LinkCheck is fail-closed there and the test cannot assert a proof.
function inspectorUnavailable(result) {
  return /not available on this Node runtime/.test(String(result.detail || ""));
}

// ---- C1: the L4 patcher must see the cited file context ----
test("L4 patch prompt carries the bounded cited-file context (C1)", function () {
  const finding = { id: "F-001", title: "t", claim: "c", evidence: [{ path: "src/a.js", startLine: 1, endLine: 2, snippet: "const a = 1;" }] };
  const messages = buildPatchMessages({ finding: finding, controlCode: "control", testCode: "trigger", excerpts: "UNIQUE_EXCERPT_MARKER" });
  const user = messages[1].content;
  assert.match(user, /Cited file context \(bounded\):/);
  assert.match(user, /UNIQUE_EXCERPT_MARKER/);
  assert.match(user, /CONTROL \(must keep passing\)/);
  assert.doesNotMatch(user, /full text of the cited file/);
  assert.doesNotMatch(PATCH_SYSTEM_PROMPT, /full text of the cited file/);
  const hugeMessages = buildPatchMessages({ finding: finding, controlCode: "c", testCode: "t", excerpts: "x".repeat(40000) });
  assert.ok(hugeMessages[1].content.length < 26000, "the cited-file context must be bounded");
});

// ---- C2: LinkCheck covers the cited file and every import ----
test("LinkCheck follows a barrel re-export to the cited file (C2)", async function (t) {
  const snapshot = snapshotWith(t, {
    "index.js": "export { value } from './lib.js';\n",
    "lib.js": "export function value(x) { return x + 1; }\n"
  });
  const testCode = "import assert from 'node:assert/strict';\nimport { value } from './index.js';\nassert.equal(value(2), 3);\n";
  const result = await runLinkCheck({ testCode: testCode, snapshotDir: snapshot, targetFiles: ["lib.js", "index.js"], symbols: ["value"] });
  if (inspectorUnavailable(result)) return;
  assert.equal(result.status, "proven", JSON.stringify(result));
  assert.deepEqual(result.targetFiles, ["lib.js", "index.js"]);
});

test("LinkCheck proves an anonymous default export through its cited file (C2)", async function (t) {
  const snapshot = snapshotWith(t, { "lib.js": "export default function () { return 7; }\n" });
  const testCode = "import assert from 'node:assert/strict';\nimport f from './lib.js';\nassert.equal(f(), 7);\n";
  const result = await runLinkCheck({ testCode: testCode, snapshotDir: snapshot, targetFiles: ["lib.js"], symbols: ["f"] });
  if (inspectorUnavailable(result)) return;
  assert.equal(result.status, "proven", JSON.stringify(result));
});

test("LinkCheck covers every repository import, not only the first (C2)", async function (t) {
  const snapshot = snapshotWith(t, {
    "a.js": "export const a = 1;\n",
    "b.js": "export function b() { return 2; }\n"
  });
  const testCode = "import assert from 'node:assert/strict';\nimport { a } from './a.js';\nimport { b } from './b.js';\nassert.equal(b(), 2);\n";
  const result = await runLinkCheck({ testCode: testCode, snapshotDir: snapshot, targetFiles: ["b.js", "a.js"], symbols: ["a", "b"] });
  if (inspectorUnavailable(result)) return;
  assert.equal(result.status, "proven", JSON.stringify(result));
});

// ---- C3: replay re-runs LinkCheck and never uses a single attempt ----
test("replay re-runs LinkCheck and uses at least three deterministic runs (C3)", async function (t) {
  const outDir = join(tempDir(t), "out");
  const run = spawnSync(process.execPath, [cliPath, "analyze", "fixtures/mini-repo", "--mock", "--mode", "demo", "--out", outDir], {
    cwd: repoRoot,
    timeout: 180000,
    env: Object.assign({}, process.env, { USE_MOCK: "1", MOCK_PIPELINE: "1" }),
    encoding: "utf8"
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const runName = readdirSync(outDir, { withFileTypes: true }).find(function (entry) { return entry.isDirectory(); }).name;
  const result = await replayRun({ reportDir: join(outDir, runName) });
  assert.equal(result.matches, true, result.problems.join("; "));
  const entry = result.findings[0];
  assert.ok(entry && entry.l3, "the replayed finding must carry the L3 result");
  assert.ok(entry.l3.attempts >= 3, "replay must not fall back to a single best-effort run");
  if (nodeMajor >= 26) {
    assert.ok(entry.linkcheck, "LinkCheck must be re-executed when the report recorded a proof");
    assert.equal(entry.linkcheck.replayed, "proven");
  } else {
    assert.ok(result.notes.some(function (note) { return /LinkCheck was not re-executed/.test(note); }), result.notes.join("; "));
  }
});

// ---- C4a: trailing newline must not add a numbered empty line ----
test("scanner input does not number a phantom trailing line (C4a)", function (t) {
  const dir = tempDir(t);
  writeFiles(dir, { "a.js": "const a = 1;\n" });
  const input = buildScannerInput(ingest(dir), 400000);
  assert.match(input.text, /1 \| const a = 1;/);
  assert.doesNotMatch(input.text, /2 \| /);
  assert.match(input.text, /\(1 lines\)/);
});

// ---- C4b: block separator bytes count against the prompt cap ----
test("scanner input counts separator bytes against the cap (C4b)", function (t) {
  const dir = tempDir(t);
  writeFiles(dir, { "a.js": "const a = 1;\n", "b.js": "const b = 2;\n", "c.js": "const c = 3;\n" });
  const repo = ingest(dir);
  const full = buildScannerInput(repo, 400000);
  assert.equal(full.filesInPrompt, 3);
  const limit = full.text.length - 2;
  const bounded = buildScannerInput(repo, limit);
  assert.ok(bounded.text.length <= limit, bounded.text.length + " > " + limit);
  assert.equal(bounded.filesInPrompt, 2);
});

// ---- C4c: the from-scan must stop at statement boundaries (ASI) ----
test("import graph does not cross statement boundaries without semicolons (C4c)", function (t) {
  const dir = tempDir(t);
  writeFiles(dir, { "a.js": "export const x = 1\nimport { y } from \"./mod.js\"\n", "mod.js": "export const y = 2;\n" });
  const repo = ingest(dir);
  const edges = repo.edges.filter(function (edge) { return edge.from === "a.js" && edge.to === "mod.js"; });
  assert.equal(edges.length, 1, "duplicate edges mean the from-scan crossed a statement boundary");
});

test("multiline imports still resolve (C4c regression)", function (t) {
  const dir = tempDir(t);
  writeFiles(dir, { "b.js": "import {\n  y\n} from \"./mod.js\"\n", "mod.js": "export const y = 2;\n" });
  const repo = ingest(dir);
  assert.equal(repo.edges.filter(function (edge) { return edge.from === "b.js" && edge.to === "mod.js"; }).length, 1);
});
