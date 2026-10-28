import assert from "node:assert/strict";
import { unifiedDiff } from "./patch/index.mjs";
const diff = unifiedDiff("alpha\nbeta", "alpha\ngamma", { label: "sample" });
assert.ok(diff.includes("-beta"));
assert.ok(diff.includes("+gamma"));
assert.equal(diff.includes("undefined"), false);
assert.equal(diff.includes("-alpha"), false);
assert.equal(diff.includes("+alpha"), false);
