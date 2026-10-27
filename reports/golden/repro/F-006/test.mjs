import assert from 'node:assert/strict';
import { sortScores, topScore } from './src/scores.ts';

assert.deepEqual(sortScores([10, 9, 100, 2]), [2, 9, 10, 100]);
assert.deepEqual(sortScores([100, 20, 3, 45]), [3, 20, 45, 100]);
assert.deepEqual(sortScores([9, 80, 100]), [9, 80, 100]);
assert.equal(topScore([10, 9, 100, 2]), 100);
console.log('sortScores numeric sort ok');
