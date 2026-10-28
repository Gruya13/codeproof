import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('https://example.com/foo', 'bar'), 'https://example.com/foo/bar');
assert.equal(combineURLs('https://example.com/foo/', 'bar'), 'https://example.com/foo/bar');
assert.equal(combineURLs('https://example.com/foo', '/bar'), 'https://example.com/foo/bar');
assert.equal(combineURLs('https://example.com/foo/', '/bar'), 'https://example.com/foo/bar');
assert.equal(combineURLs('https://example.com/foo///', '///bar'), 'https://example.com/foo/bar');
assert.equal(combineURLs('https://example.com/foo', ''), 'https://example.com/foo');
