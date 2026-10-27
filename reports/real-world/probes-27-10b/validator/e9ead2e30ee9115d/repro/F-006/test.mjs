import assert from 'node:assert/strict';
import isVAT from './lib/isVAT.js';

assert.equal(isVAT('', 'HN'), false, 'empty string must not be a valid HN VAT');
assert.equal(isVAT('', 'PA'), false, 'empty string must not be a valid PA VAT');
