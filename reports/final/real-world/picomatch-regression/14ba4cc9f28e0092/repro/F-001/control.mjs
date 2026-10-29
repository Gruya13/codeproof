import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('a/b', { tokens: true });
assert.equal(result.tokens[result.tokens.length - 1].value, 'b');
assert.equal(result.maxDepth, 2);
