import assert from "node:assert/strict";
import { withoutLeadingSlash } from "./utils.ts";
assert.strictEqual(withoutLeadingSlash("/foo"), "foo");
assert.strictEqual(withoutLeadingSlash("foo"), "foo");
assert.strictEqual(withoutLeadingSlash("/foo/bar"), "foo/bar");
assert.strictEqual(withoutLeadingSlash(""), "");
assert.strictEqual(withoutLeadingSlash("/"), "");
assert.strictEqual(withoutLeadingSlash(), "");
