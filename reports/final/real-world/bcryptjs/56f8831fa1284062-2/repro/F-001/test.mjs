import assert from "node:assert/strict";
import { decodeBase64 } from "./index.js";
const result = decodeBase64("AAA!", 3);
assert.deepEqual(result, [8, 32]);
assert.equal(result.length, 2);
