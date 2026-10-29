import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';
const result = validate({});
assert.deepEqual(result, ['id is required', 'value is required']);
