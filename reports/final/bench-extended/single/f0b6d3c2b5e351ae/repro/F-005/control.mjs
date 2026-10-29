import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

const result = isAxiosError({ isAxiosError: false });
assert.equal(result, false);
