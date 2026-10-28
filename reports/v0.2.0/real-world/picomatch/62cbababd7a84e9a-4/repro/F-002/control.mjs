import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('foo/bar', { tokens: true });
assert.equal(result.tokens.length, 2);
assert.equal(result.tokens[0].value, 'foo');
assert.equal(result.tokens[1].value, 'bar');
