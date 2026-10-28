import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

let args;
const result = spread(function (x, y, z) {
  args = [x, y, z];
  return x + y + z;
})([1, 2, 3]);
assert.deepEqual(args, [1, 2, 3]);
assert.equal(result, 6);

let count;
let first;
spread(function () {
  count = arguments.length;
  first = arguments[0];
})([1, 2, 3]);
assert.equal(count, 3);
assert.equal(first, 1);
