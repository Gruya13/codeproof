import assert from 'node:assert/strict';
import { collect } from './src/analytics.ts';
const delayed = (value, ms) => async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
};
const result = await collect([delayed(1, 20), delayed(2, 10)]);
assert.deepEqual(result, [1, 2]);
