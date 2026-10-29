import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';
const result = buildURL('https://example.com/path#section', { b: 2 });
assert.equal(result, 'https://example.com/path?b=2');
