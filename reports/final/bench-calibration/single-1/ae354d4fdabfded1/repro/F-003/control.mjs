import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';

const errors = validate({});
assert.equal(errors.length, 2);
assert.equal(errors.includes('id is required'), true);
assert.equal(errors.includes('value is required'), true);
