import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const result = jsesc(255, { numbers: 'hexadecimal' });
assert.equal(result, '0xFF');
