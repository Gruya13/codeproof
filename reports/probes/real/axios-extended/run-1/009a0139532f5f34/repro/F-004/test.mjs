import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

// Plain objects lacking the flag are not Axios errors
assert.equal(isAxiosError({}), false);
assert.equal(isAxiosError({ message: 'boom', code: 'ERR' }), false);
assert.equal(isAxiosError(new Error('boom')), false);
assert.equal(isAxiosError({ isAxiosError: undefined }), false);

// Explicitly marked / unmarked payloads
assert.equal(isAxiosError({ isAxiosError: true }), true);
assert.equal(isAxiosError({ isAxiosError: false }), false);

// Non-objects are not Axios errors
assert.equal(isAxiosError(null), false);
assert.equal(isAxiosError('error'), false);
assert.equal(isAxiosError(42), false);
