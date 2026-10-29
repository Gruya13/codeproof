import assert from 'node:assert/strict';
import { sortScores } from './src/scores.ts';
const result = sortScores([9, 100, 20]);
assert.deepEqual(result, [9, 20, 100]);
