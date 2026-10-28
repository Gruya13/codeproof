import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('foo/*.js');
assert.equal(result.isGlob, true);
assert.equal(result.glob, '*.js');
