import assert from 'node:assert/strict';
import { sortScores } from './src/scores.ts';
const result = sortScores([10, 9, 2]);
assert.deepEqual(result, [2, 9, 10]);
