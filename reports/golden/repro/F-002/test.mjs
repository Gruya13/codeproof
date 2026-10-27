import assert from 'node:assert/strict';
import { collect } from './src/analytics.ts';

const results = await collect([
  async () => 10,
  async () => 20,
  async () => 30,
]);
assert.deepEqual(results, [10, 20, 30]);

const delayed = await collect([
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return 42;
  },
]);
assert.deepEqual(delayed, [42]);

const errorResults = await collect([
  async () => {
    throw new Error('boom');
  },
]);
assert.deepEqual(errorResults, []);
