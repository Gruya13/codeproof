import assert from 'node:assert/strict';
import isAxiosError from './helpers/isAxiosError.js';

const result = isAxiosError({ message: 'plain object' });
assert.equal(result, false);
