import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

// Documented example: spread(function(x, y, z) {})([1, 2, 3])
let argsSeen;
const result = spread(function (x, y, z) {
  argsSeen = [x, y, z];
  return x + y + z;
})([1, 2, 3]);

assert.deepEqual(argsSeen, [1, 2, 3]);
assert.equal(result, 6);
assert.deepEqual(spread((...args) => args)(['a', 'b']), ['a', 'b']);
