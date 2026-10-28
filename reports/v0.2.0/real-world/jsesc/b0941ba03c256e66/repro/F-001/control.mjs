import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hex = jsesc(10, { numbers: 'hexadecimal' });
assert.equal(hex, '0xA');
const bin = jsesc(5, { numbers: 'binary' });
assert.equal(bin, '0b101');
const oct = jsesc(8, { numbers: 'octal' });
assert.equal(oct, '0o10');
