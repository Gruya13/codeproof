import assert from 'node:assert/strict';
import { topScore } from './src/scores.ts';
const result = topScore([9, 10, 100]);
assert.equal(result, 100);
