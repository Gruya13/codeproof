import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';
const errors = validate({ id: 'abc', value: 42 });
assert.equal(errors.length, 0);
assert.deepEqual(errors, []);
