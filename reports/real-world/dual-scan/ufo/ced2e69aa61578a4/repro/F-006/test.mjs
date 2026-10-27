import assert from "node:assert/strict";
import { joinRelativeURL } from "./utils.ts";

assert.equal(joinRelativeURL("../a", "b"), "../a/b");
assert.equal(joinRelativeURL("../a"), "../a");
assert.equal(joinRelativeURL("../../a", "b"), "../../a/b");
assert.equal(joinRelativeURL("/a", "../b", "./c"), "/b/c");
