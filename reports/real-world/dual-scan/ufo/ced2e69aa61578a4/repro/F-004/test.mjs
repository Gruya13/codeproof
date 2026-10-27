import assert from "node:assert/strict";
import { withBase, withoutBase } from "./utils.ts";

// Hash is a delimiter after the base, like '/' and '?'
assert.equal(withBase("/foo#bar", "/foo"), "/foo#bar");
assert.equal(withBase("/foo#bar", "/foo/"), "/foo#bar");
assert.equal(withoutBase("/foo#bar", "/foo"), "/#bar");

// Existing query-delimiter behaviour (consistency anchors)
assert.equal(withBase("/foo?bar", "/foo"), "/foo?bar");
assert.equal(withoutBase("/foo?bar", "/foo"), "/?bar");
assert.equal(withoutBase("/foo/bar#baz", "/foo"), "/bar#baz");

// Non-delimiter prefixes must not be treated as having the base
assert.equal(withBase("/foobar#baz", "/foo"), "/foo/foobar#baz");
assert.equal(withoutBase("/foobar#baz", "/foo"), "/foobar#baz");
assert.equal(withoutBase("/foo-bar#baz", "/foo"), "/foo-bar#baz");
