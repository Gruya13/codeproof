import assert from "node:assert/strict";
import { decodeBase64 } from "./index.js";
const result = decodeBase64("...!", 3);
assert.deepEqual(result, [0, 0]);
