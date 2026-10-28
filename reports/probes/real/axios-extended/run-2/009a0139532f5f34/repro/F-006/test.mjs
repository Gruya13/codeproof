import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';

assert.equal(
  buildURL('https://example.com/path#section', { a: 1 }),
  'https://example.com/path?a=1'
);
assert.equal(
  buildURL('https://example.com/path?x=1#section', { a: 1 }),
  'https://example.com/path?x=1&a=1'
);
assert.equal(
  buildURL('https://example.com/path#', { q: 'hello' }),
  'https://example.com/path?q=hello'
);
assert.equal(
  buildURL('https://example.com/path', { a: 1 }),
  'https://example.com/path?a=1'
);
