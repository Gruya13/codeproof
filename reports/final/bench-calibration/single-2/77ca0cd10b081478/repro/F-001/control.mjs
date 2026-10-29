import assert from 'node:assert/strict';
import { collect } from './src/analytics.ts';

const results = await collect([]);
assert.deepEqual(results, []);
