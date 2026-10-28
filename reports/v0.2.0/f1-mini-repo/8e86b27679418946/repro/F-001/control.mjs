import assert from 'node:assert/strict';
import { page } from './src/pagination.js';
const result = page([1, 2], 0, 2);
assert.deepEqual(result, [1, 2]);
assert.equal(result.length, 2);
