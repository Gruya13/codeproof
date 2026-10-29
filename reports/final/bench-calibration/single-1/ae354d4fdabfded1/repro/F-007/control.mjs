import assert from 'node:assert/strict';
import { sortScores } from './src/scores.ts';
const result = sortScores([3, 1, 2]);
assert.deepEqual(result, [1, 2, 3]);
