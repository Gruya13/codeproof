import assert from "node:assert/strict";
import { decodeBase64 } from "./index.js";
const result = decodeBase64("AA!A", 3);
assert.deepEqual(result, [8]);
assert.equal(result.length, 1);
