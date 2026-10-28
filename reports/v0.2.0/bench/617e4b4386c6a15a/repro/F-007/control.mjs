import assert from 'node:assert/strict';
import { sortScores } from './src/scores.ts';
const sorted = sortScores([3, 1, 2]);
assert.deepEqual(sorted, [1, 2, 3]);
