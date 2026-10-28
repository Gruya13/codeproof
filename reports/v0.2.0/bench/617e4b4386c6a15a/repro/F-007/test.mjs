import assert from 'node:assert/strict';
import { sortScores } from './src/scores.ts';
const sorted = sortScores([10, 9, 100]);
assert.deepEqual(sorted, [9, 10, 100]);
