import assert from "node:assert/strict";
import { parseAuth } from "./parse.ts";

const result = parseAuth("user:pass:word");
assert.equal(result.username, "user");
assert.equal(result.password, "pass:word");

const multi = parseAuth("alice:p:a:s:s");
assert.equal(multi.username, "alice");
assert.equal(multi.password, "p:a:s:s");
