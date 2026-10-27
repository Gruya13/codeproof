import assert from "node:assert/strict";
import { withoutBase } from "./utils.ts";

let result;
let error = null;
try {
  result = withoutBase("/foo#section", "/foo");
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.equal(result, "/#section");
assert.equal(withoutBase("/foo?query=1", "/foo"), "/?query=1");
assert.equal(withoutBase("/foo/bar#section", "/foo"), "/bar#section");
assert.equal(withoutBase("/foobar#section", "/foo"), "/foobar#section");
assert.equal(withoutBase("/foo-bar", "/foo"), "/foo-bar");
