import assert from 'node:assert/strict';
import { validate } from './src/validation.ts';
const result = validate({ id: 'user-1', value: 42 });
assert.deepEqual(result, []);
