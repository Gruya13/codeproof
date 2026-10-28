import assert from 'node:assert/strict';
import buildURL from './helpers/buildURL.js';

const withHash = buildURL('https://example.com/path#section', {foo: 'bar'});
const parsed1 = new URL(withHash);
assert.equal(parsed1.searchParams.get('foo'), 'bar');
assert.equal(parsed1.search, '?foo=bar');
assert.equal(parsed1.hash.includes('foo=bar'), false);

const withQueryAndHash = buildURL('https://example.com/path?x=1#section', {foo: 'bar'});
const parsed2 = new URL(withQueryAndHash);
assert.equal(parsed2.searchParams.get('x'), '1');
assert.equal(parsed2.searchParams.get('foo'), 'bar');
assert.equal(parsed2.hash.includes('foo=bar'), false);

const hashOnly = buildURL('https://example.com/path#', {a: '1'});
assert.equal(new URL(hashOnly).searchParams.get('a'), '1');
