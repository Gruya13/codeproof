import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';

const result1 = buildURL('https://example.com/path#section', { foo: 'bar' });
assert.equal(result1, 'https://example.com/path?foo=bar');
assert.equal(result1.includes('#'), false);

const result2 = buildURL('https://example.com/path?x=1#frag', { a: '1' });
assert.equal(result2, 'https://example.com/path?x=1&a=1');
assert.equal(result2.includes('#'), false);

const result3 = buildURL('https://example.com/path#', { q: 'test' });
assert.equal(result3, 'https://example.com/path?q=test');
