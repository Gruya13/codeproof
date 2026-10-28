import assert from "node:assert/strict";
import { unifiedDiff } from "./patch/index.mjs";
const diff = unifiedDiff("a\nb\nc", "a\nX\nc", { label: "patch" });
assert.equal(diff, "--- a/patch\n+++ b/patch\n@@ -2,1 +2,1 @@\n-b\n+X");
assert.equal(diff.includes("undefined"), false);
