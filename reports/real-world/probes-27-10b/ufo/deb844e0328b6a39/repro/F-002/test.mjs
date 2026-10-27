import assert from "node:assert/strict";
import { withFragment } from "./utils.ts";

assert.equal(withFragment("/foo", "bar"), "/foo#bar");
assert.equal(withFragment("/foo#bar", "baz"), "/foo#baz");
assert.equal(withFragment("/foo#bar", ""), "/foo");
