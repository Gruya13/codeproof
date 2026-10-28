import assert from 'node:assert/strict';
import scan from './scan.js';

const result = scan('*', { noext: true });
assert.equal(result.isExtglob, false);
assert.equal(result.isGlob, true);
assert.equal(result.glob, '*');
