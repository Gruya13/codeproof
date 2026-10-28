import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('http://a/b', 'c'), 'http://a/b/c');
assert.equal(combineURLs('http://a/b/', 'c'), 'http://a/b/c');
assert.equal(combineURLs('http://a/b', '/c'), 'http://a/b/c');
assert.equal(combineURLs('http://a/b/', '/c'), 'http://a/b/c');
assert.equal(combineURLs('http://a/b', ''), 'http://a/b');
