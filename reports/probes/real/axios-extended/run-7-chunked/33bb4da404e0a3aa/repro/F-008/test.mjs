import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

assert.equal(isAxiosError({ isAxiosError: true }), true);
assert.equal(isAxiosError({ isAxiosError: false }), false);
assert.equal(isAxiosError({}), false);
assert.equal(isAxiosError({ name: 'Error', message: 'boom' }), false);
assert.equal(isAxiosError({ isAxiosError: undefined }), false);
assert.equal(isAxiosError([]), false);
assert.equal(isAxiosError(null), false);
assert.equal(isAxiosError('boom'), false);
