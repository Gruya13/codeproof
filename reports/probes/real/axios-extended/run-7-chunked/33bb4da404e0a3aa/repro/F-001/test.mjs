import assert from 'node:assert/strict';
import utils from './utils.js';

const { matchAll } = utils;
assert.equal(typeof matchAll, 'function');

// Bound exec so a non-advancing implementation terminates in the harness
// instead of hanging forever: after 10 calls it reports no further match.
// A correct matchAll must advance past zero-length matches on its own.
let calls = 0;
const regExp = /a*/g;
const originalExec = regExp.exec.bind(regExp);
regExp.exec = (str) => {
  calls += 1;
  if (calls > 10) {
    return null;
  }
  return originalExec(str);
};

let result;
let thrown = null;
try {
  result = matchAll(regExp, 'b');
} catch (err) {
  thrown = err;
}

assert.equal(thrown, null);
assert.equal(Array.isArray(result), true);
// Native matchAll semantics: empty matches at index 0 and index 1.
assert.equal(result.length, 2);
assert.equal(result[0][0], '');
assert.equal(result[0].index, 0);
assert.equal(result[1][0], '');
assert.equal(result[1].index, 1);
assert.equal(calls <= 3, true);
