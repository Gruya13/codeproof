import assert from 'node:assert/strict';
import { collect } from './src/analytics.ts';
const result = await collect([]);
assert.deepEqual(result, []);
assert.equal(result.length, 0);
