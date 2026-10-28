import assert from "node:assert/strict";
import { buildScannerInput } from "./ingest/index.mjs";
const result = {
  root: ".",
  files: [{ path: "a.js", loc: 1 }],
  sources: new Map([["a.js", "a"]]),
};
const out = buildScannerInput(result, 100);
assert.equal(out.chars, out.text.length);
assert.ok(out.text.length <= out.cap);
assert.equal(out.filesInPrompt, 1);
