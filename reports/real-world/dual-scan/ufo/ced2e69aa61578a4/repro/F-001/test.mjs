import assert from "node:assert/strict";
import { withFragment } from "./utils.ts";

let result;
let thrown = null;
try {
  result = withFragment("/foo#bar", "");
} catch (error) {
  thrown = error;
}
assert.equal(thrown, null);
assert.equal(result, "/foo");
assert.equal(withFragment("/foo", "bar"), "/foo#bar");
assert.equal(withFragment("/foo#bar", "baz"), "/foo#baz");
