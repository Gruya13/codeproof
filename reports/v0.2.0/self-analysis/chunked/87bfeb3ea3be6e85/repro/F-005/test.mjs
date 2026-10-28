import assert from "node:assert/strict";
import { buildScannerInput } from "./ingest/index.mjs";
const result = {
  root: ".",
  files: [
    { path: "a.js", loc: 1 },
    { path: "b.js", loc: 1 },
    { path: "c.js", loc: 1 },
  ],
  sources: new Map([
    ["a.js", "a"],
    ["b.js", "a"],
    ["c.js", "a"],
  ]),
};
const out = buildScannerInput(result, 74);
assert.equal(out.chars, out.text.length);
assert.ok(out.text.length <= out.cap);
assert.equal(out.filesInPrompt, 3);
