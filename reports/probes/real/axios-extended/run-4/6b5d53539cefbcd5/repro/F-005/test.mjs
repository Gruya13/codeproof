import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('http://api', 'users'), 'http://api/users');
assert.equal(combineURLs('http://api/', 'users'), 'http://api/users');
assert.equal(combineURLs('http://api/', '/users'), 'http://api/users');
assert.equal(combineURLs('http://api///', '///users'), 'http://api/users');
assert.equal(combineURLs('https://example.com/base', '/v1/items'), 'https://example.com/base/v1/items');
