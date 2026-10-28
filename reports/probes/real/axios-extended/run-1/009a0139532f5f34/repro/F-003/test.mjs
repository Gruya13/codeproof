import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

let error = null;
let received = null;
let result = null;
try {
  result = spread(function (x, y, z) {
    received = [x, y, z];
    return x + y + z;
  })([1, 2, 3]);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received, [1, 2, 3]);
assert.equal(result, 6);

let received2 = null;
try {
  received2 = spread((...args) => args)(['a', 'b']);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received2, ['a', 'b']);
