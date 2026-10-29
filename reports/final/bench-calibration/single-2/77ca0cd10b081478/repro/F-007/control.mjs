import assert from 'node:assert/strict';
import { topScore } from './src/scores.ts';
const result = topScore([1, 2, 3]);
assert.equal(result, 3);
