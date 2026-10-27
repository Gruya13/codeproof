import assert from "node:assert/strict";
import { isJSONSerializable } from "./src/utils.ts";

let thrown = null;
let result;
try {
  result = isJSONSerializable(null);
} catch (error) {
  thrown = error;
}
assert.equal(thrown, null, `isJSONSerializable(null) should not throw, got: ${thrown}`);
assert.equal(result, true, "null is JSON serializable, expected true");
assert.equal(isJSONSerializable("x"), true);
assert.equal(isJSONSerializable(42), true);
assert.equal(isJSONSerializable(true), true);
assert.equal(isJSONSerializable(undefined), false);
