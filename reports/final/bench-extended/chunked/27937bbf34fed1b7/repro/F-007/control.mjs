import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';
const result = buildURL('https://example.com/path', { a: 1 });
assert.equal(result, 'https://example.com/path?a=1');
