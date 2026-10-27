import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';

// A complete payload satisfies both required fields, so no errors.
assert.deepEqual(validate({ id: 'abc', value: 42 }), []);
assert.deepEqual(validate({ id: 'abc', value: 0 }), []);
// Missing fields should report only their own required error.
assert.deepEqual(validate({ id: 'abc' }), ['value is required']);
assert.deepEqual(validate({ value: 42 }), ['id is required']);
assert.deepEqual(validate({}), ['id is required', 'value is required']);
