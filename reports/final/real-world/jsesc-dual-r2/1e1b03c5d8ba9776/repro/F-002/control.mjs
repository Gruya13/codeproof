import assert from 'node:assert/strict';
import jsesc from './jsesc.js';

const hex = jsesc(255, { numbers: 'hexadecimal' });
assert.equal(hex, '0xFF');
const bin = jsesc(5, { numbers: 'binary' });
assert.equal(bin, '0b101');
const oct = jsesc(8, { numbers: 'octal' });
assert.equal(oct, '0o10');
const big = jsesc(255n, { numbers: 'hexadecimal' });
assert.equal(big, '0xFFn');
