import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hexResult = jsesc(-10, { numbers: 'hexadecimal' });
assert.equal(hexResult, '-0xA');
const binResult = jsesc(-10, { numbers: 'binary' });
assert.equal(binResult, '-0b1010');
const octResult = jsesc(-10, { numbers: 'octal' });
assert.equal(octResult, '-0o12');
