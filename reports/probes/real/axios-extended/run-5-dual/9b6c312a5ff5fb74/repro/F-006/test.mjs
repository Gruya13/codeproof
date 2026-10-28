import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

// Plain objects are not Axios errors and must return false
assert.equal(isAxiosError({}), false);
assert.equal(isAxiosError({ foo: 'bar' }), false);
assert.equal(isAxiosError({ isAxiosError: undefined }), false);
assert.equal(isAxiosError({ message: 'boom', name: 'Error' }), false);

// Positive and explicit-negative controls
assert.equal(isAxiosError({ isAxiosError: true }), true);
assert.equal(isAxiosError({ isAxiosError: false }), false);
assert.equal(isAxiosError(null), false);
assert.equal(isAxiosError('error'), false);
assert.equal(isAxiosError(42), false);
