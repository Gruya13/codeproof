import assert from 'node:assert/strict';
import { pageSlice } from './src/paging.ts';
const result = pageSlice([1, 2, 3], { page: 0, size: 3 });
assert.deepEqual(result, [1, 2, 3]);
assert.equal(result.length, 3);
