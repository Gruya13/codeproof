import assert from 'node:assert/strict';
import utils from './utils.js';

const merge = utils.merge;

const caselessResult = merge.call(
  { caseless: true },
  { headers: { 'Content-Type': 'a', 'X-Test': '1' } },
  { headers: { 'content-type': 'b' } }
);
assert.deepEqual(caselessResult, {
  headers: { 'Content-Type': 'b', 'X-Test': '1' },
});

const skipResult = merge.call(
  { skipUndefined: true },
  { nested: { a: 1, b: 2 } },
  { nested: { a: undefined } }
);
assert.deepEqual(skipResult, { nested: { a: 1, b: 2 } });

const copyResult = merge.call(
  { caseless: true, skipUndefined: true },
  {},
  { nested: { 'X-A': 1, 'x-a': 2, gone: undefined } }
);
assert.deepEqual(copyResult, { nested: { 'X-A': 2 } });
