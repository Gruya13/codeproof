import assert from 'node:assert/strict';
import { page } from './src/pagination.js';
const result = page([1, 2, 3], 0, 3);
assert.deepEqual(result, [1, 2, 3]);
assert.equal(result.length, 3);
