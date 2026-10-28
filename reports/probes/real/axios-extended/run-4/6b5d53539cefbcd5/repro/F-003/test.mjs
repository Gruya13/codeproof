import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';
import AxiosError from './core/AxiosError.js';

let thrown = null;
let plainResult;
try {
  plainResult = isAxiosError({});
} catch (e) {
  thrown = e;
}
assert.equal(thrown, null);
assert.equal(plainResult, false);
assert.equal(isAxiosError({ message: 'boom', code: 'ERR' }), false);
assert.equal(isAxiosError(new Error('boom')), false);
assert.equal(isAxiosError({ isAxiosError: false }), false);
assert.equal(isAxiosError(null), false);
assert.equal(isAxiosError(undefined), false);
assert.equal(isAxiosError('error'), false);
assert.equal(isAxiosError(new AxiosError('boom')), true);
assert.equal(isAxiosError({ isAxiosError: true }), true);
