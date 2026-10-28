import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

let received;
let error = null;
try {
  received = spread(function (x, y, z) { return [x, y, z]; })([1, 2, 3]);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received, [1, 2, 3]);

let argCount;
let sumError = null;
let sum;
try {
  sum = spread(function (a, b) { argCount = arguments.length; return a + b; })([2, 3]);
} catch (e) {
  sumError = e;
}
assert.equal(sumError, null);
assert.equal(argCount, 2);
assert.equal(sum, 5);
