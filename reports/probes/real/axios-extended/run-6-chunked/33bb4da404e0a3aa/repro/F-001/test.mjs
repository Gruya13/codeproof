import assert from 'node:assert/strict';
import utils from './utils.js';

const { matchAll } = utils;
assert.equal(typeof matchAll, 'function');

function bounded(re, limit = 20) {
  let calls = 0;
  const orig = re.exec.bind(re);
  re.exec = (str) => {
    calls += 1;
    if (calls > limit) return null;
    return orig(str);
  };
  return re;
}

let error = null;
let result = null;
try {
  result = matchAll(bounded(/a*/g), 'b');
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(
  result.map((m) => [m[0], m.index]),
  [['', 0], ['', 1]]
);

error = null;
result = null;
try {
  result = matchAll(bounded(/a*/g), 'aaa');
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.deepEqual(
  result.map((m) => [m[0], m.index]),
  [['aaa', 0], ['', 3]]
);
