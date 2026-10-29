import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';
const errors = validate({});
assert.equal(errors.length, 2);
assert.deepEqual(errors, ['id is required', 'value is required']);
