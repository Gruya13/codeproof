import assert from "node:assert/strict";
import { parseURL } from "./parse.ts";

let thrown = null;
let parsed;
try {
  parsed = parseURL("mailto:foo@example.com");
} catch (error) {
  thrown = error;
}
assert.equal(thrown, null);
assert.equal(parsed.protocol, "mailto:");
assert.equal(parsed.pathname, "foo@example.com");
assert.equal(parsed.host, "");
assert.equal(parsed.auth, "");
assert.equal(parsed.search, "");
assert.equal(parsed.hash, "");

let parsed2;
try {
  parsed2 = parseURL("mailto:foo@example.com?subject=hello#frag");
} catch (error) {
  thrown = error;
}
assert.equal(thrown, null);
assert.equal(parsed2.protocol, "mailto:");
assert.equal(parsed2.pathname, "foo@example.com");
assert.equal(parsed2.search, "?subject=hello");
assert.equal(parsed2.hash, "#frag");
