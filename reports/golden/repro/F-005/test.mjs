import assert from 'node:assert/strict';
import { pageSlice } from './src/paging.ts';

const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

assert.deepEqual(pageSlice(items, { page: 0, size: 3 }), [0, 1, 2]);
assert.deepEqual(pageSlice(items, { page: 1, size: 3 }), [3, 4, 5]);
assert.deepEqual(pageSlice(items, { page: 2, size: 3 }), [6, 7, 8]);
assert.equal(pageSlice(items, { page: 0, size: 5 }).length, 5);
assert.deepEqual(pageSlice(items, { page: 0, size: 5 }), [0, 1, 2, 3, 4]);
assert.deepEqual(pageSlice(items, { page: 3, size: 3 }), [9]);
