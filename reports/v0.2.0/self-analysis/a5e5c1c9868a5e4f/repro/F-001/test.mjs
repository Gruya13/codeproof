import assert from "node:assert/strict";
import { unifiedDiff } from "./patch/index.mjs";
const diff = unifiedDiff("alpha\nbeta", "alpha\nbeta\ngamma", { label: "sample" });
assert.equal(diff.includes("undefined"), false);
assert.ok(diff.includes("+gamma"));
assert.equal(diff.includes("-alpha"), false);
assert.equal(diff.includes("-beta"), false);
assert.equal(diff.includes("+alpha"), false);
assert.equal(diff.includes("+beta"), false);
