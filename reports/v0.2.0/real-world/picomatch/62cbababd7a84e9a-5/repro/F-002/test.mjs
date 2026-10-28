import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('bar/*.txt', { noext: true });
assert.equal(result.isGlob, true);
assert.equal(result.glob, '*.txt');
