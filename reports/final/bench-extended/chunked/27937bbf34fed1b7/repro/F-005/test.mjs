import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';
const result = combineURLs('http://a/b', 'c');
assert.equal(result, 'http://a/b/c');
