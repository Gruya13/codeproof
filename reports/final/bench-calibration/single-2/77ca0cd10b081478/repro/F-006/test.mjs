import assert from 'node:assert/strict';
import { pageSlice } from './src/paging.ts';
const result = pageSlice([1, 2, 3, 4], { page: 0, size: 2 });
assert.equal(result.length, 2);
assert.deepEqual(result, [1, 2]);
