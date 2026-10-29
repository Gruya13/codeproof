import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';
const result = combineURLs('https://example.com/api', '');
assert.equal(result, 'https://example.com/api');
