import assert from "node:assert/strict";
import { unifiedDiff } from "./patch/index.mjs";
const diff = unifiedDiff("a\nb", "a\nb\nc", { label: "patch" });
assert.equal(diff.includes("undefined"), false);
assert.equal(diff.includes("+c"), true);
assert.equal(diff.includes("\n-a"), false);
assert.equal(diff.includes("\n-b"), false);
assert.equal(diff.includes("@@ -0,"), false);
assert.equal(diff.includes(" +0,"), false);
