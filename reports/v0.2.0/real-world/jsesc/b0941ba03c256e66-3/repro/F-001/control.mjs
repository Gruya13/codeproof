import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hex = jsesc(255, { numbers: 'hexadecimal' });
assert.equal(hex, '0xFF');
const bin = jsesc(6, { numbers: 'binary' });
assert.equal(bin, '0b110');
const oct = jsesc(9, { numbers: 'octal' });
assert.equal(oct, '0o11');
