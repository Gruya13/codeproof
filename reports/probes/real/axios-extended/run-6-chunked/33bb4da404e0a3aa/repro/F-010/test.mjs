import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

let error = null;
let received = null;
try {
  received = spread(function (x, y, z) {
    return [x, y, z];
  })([1, 2, 3]);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received, [1, 2, 3]);

let received2 = null;
try {
  received2 = spread((a, b) => [a, b])(['a', 'b']);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received2, ['a', 'b']);
