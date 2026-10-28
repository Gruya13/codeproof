import assert from 'node:assert/strict';
import scan from './scan.js';

const result = scan('/foo', { tokens: true });
assert.equal(result.tokens.length, 2);
assert.equal(result.tokens[result.tokens.length - 1].value, 'foo');
assert.equal(result.maxDepth, 2);
assert.deepEqual(result.parts, ['', 'foo']);
