import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

let received = null;
let returned = null;
let error = null;
try {
  returned = spread(function (...args) {
    received = args;
    return args;
  })([1, 2, 3]);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(received, [1, 2, 3]);
assert.deepEqual(returned, [1, 2, 3]);

let xyz = null;
let error2 = null;
try {
  xyz = spread(function (x, y, z) { return [x, y, z]; })(['a', 'b', 'c']);
} catch (e) {
  error2 = e;
}
assert.equal(error2, null);
assert.deepEqual(xyz, ['a', 'b', 'c']);
