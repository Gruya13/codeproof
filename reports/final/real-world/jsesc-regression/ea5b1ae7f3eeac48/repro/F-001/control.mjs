import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hexResult = jsesc(255, { numbers: 'hexadecimal' });
assert.equal(hexResult, '0xFF');
const binResult = jsesc(10, { numbers: 'binary' });
assert.equal(binResult, '0b1010');
