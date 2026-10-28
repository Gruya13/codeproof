import assert from 'node:assert/strict';
import scan from './scan.js';

const result = scan('foo/bar', { tokens: true });
assert.equal(result.tokens.length, 2);
assert.equal(result.tokens[result.tokens.length - 1].value, 'bar');
assert.equal(result.maxDepth, 2);
assert.deepEqual(result.parts, ['foo', 'bar']);
