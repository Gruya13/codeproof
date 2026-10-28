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
  buildURL('https://example.com/path#', { q: 'hello world' }),
  'https://example.com/path?q=hello+world'
);
const parsed = new URL(buildURL('https://example.com/path#frag', { a: 1 }));
assert.equal(parsed.searchParams.get('a'), '1');
assert.equal(parsed.hash, '');
