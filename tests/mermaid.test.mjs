import test from "node:test";
import assert from "node:assert/strict";
import { mermaidGraph } from "../src/synthesize/index.mjs";

test("T-C14: Mermaid labels escape special file names while preserving graph structure", function () {
  const repo = {
    files: [
      { path: 'src/a"b.ts' },
      { path: "src/line\nb.ts" },
      { path: "src/[user]\u0001.ts" }
    ],
    edges: [
      { from: 'src/a"b.ts', to: "src/line\nb.ts" },
      { from: "src/line\nb.ts", to: "src/[user]\u0001.ts" }
    ],
    cycles: [['src/a"b.ts', "src/line\nb.ts", 'src/a"b.ts']]
  };
  const lines = mermaidGraph(repo).split("\n");
  assert.equal(lines[0], "graph LR");
  assert.equal(lines.length, 1 + repo.files.length + repo.edges.length + repo.cycles.length);
  const labels = lines.filter(function (line) { return /^  n\d+\["/.test(line); });
  assert.equal(labels.length, repo.files.length);
  for (const line of labels) {
    const match = /^  n\d+\["([^"\n]*)"\]$/.exec(line);
    assert.ok(match, "invalid Mermaid label: " + line);
    assert.equal(/[\x00-\x1f\x7f]/.test(match[1]), false);
  }
  assert.ok(labels[0].includes("a#quot;b.ts"));
  assert.ok(labels[1].includes("line<br/>b.ts"));
  assert.ok(labels[2].includes("[user].ts"));
  assert.deepEqual(lines.filter(function (line) { return line.includes(" --> "); }), [
    "  n0 --> n1", "  n1 --> n2"
  ]);
  assert.equal(lines.filter(function (line) { return line.startsWith("  %% cycle:"); }).length, 1);
});
