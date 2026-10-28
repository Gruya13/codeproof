import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';

// Fragment (including '#') must be removed before appending params.
assert.equal(buildURL('http://example.com/path#fragment', { a: 1 }), 'http://example.com/path?a=1');
assert.equal(buildURL('/foo#bar', { a: 1 }), '/foo?a=1');
// Existing query string must be preserved and extended with '&'.
assert.equal(buildURL('/foo?x=1#bar', { a: 1 }), '/foo?x=1&a=1');
// Result must not contain a hash at all when params are appended.
const result = buildURL('http://example.com/path#frag', { q: 'hello' });
assert.equal(result.includes('#'), false);
assert.equal(result, 'http://example.com/path?q=hello');
