import assert from 'node:assert/strict';
import { collect } from './src/analytics.ts';

const task = (value) => async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return value;
};
const results = await collect([task(10), task(20)]);
assert.deepEqual(results, [10, 20]);
