import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

let caught = null;
let plain, arbitrary, plainError, explicitTrue, explicitFalse, nonObject;
try {
  plain = isAxiosError({});
  arbitrary = isAxiosError({message: 'boom', code: 'ERR'});
  plainError = isAxiosError(new Error('boom'));
  explicitTrue = isAxiosError({isAxiosError: true});
  explicitFalse = isAxiosError({isAxiosError: false});
  nonObject = isAxiosError(null);
} catch (err) {
  caught = err;
}
assert.equal(caught, null);
assert.equal(plain, false);
assert.equal(arbitrary, false);
assert.equal(plainError, false);
assert.equal(explicitTrue, true);
assert.equal(explicitFalse, false);
assert.equal(nonObject, false);
