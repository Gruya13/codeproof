import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('http://a', '/foo'), 'http://a/foo');
assert.equal(combineURLs('http://a/', '/foo'), 'http://a/foo');
assert.equal(combineURLs('http://a', 'foo'), 'http://a/foo');
assert.equal(combineURLs('http://a/', 'foo'), 'http://a/foo');
assert.equal(combineURLs('http://a/base', '/foo/bar'), 'http://a/base/foo/bar');
assert.equal(combineURLs('http://a/base/', '/foo'), 'http://a/base/foo');
