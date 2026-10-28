import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('https://example.com/api', '/users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api/', '/users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api', 'users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api/', 'users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api///', '///users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api', ''), 'https://example.com/api');
