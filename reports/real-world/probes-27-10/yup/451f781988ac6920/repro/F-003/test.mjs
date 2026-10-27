import assert from 'node:assert/strict';
import { number } from './src/index.ts';

const schema = number().max(10);

let asyncError;
try {
  await schema.validate('20');
} catch (err) {
  asyncError = err;
}
assert.ok(asyncError);
assert.strictEqual(asyncError.name, 'ValidationError');
assert.strictEqual(asyncError.value, 20);

let syncError;
try {
  schema.validateSync('20');
} catch (err) {
  syncError = err;
}
assert.ok(syncError);
assert.strictEqual(syncError.name, 'ValidationError');
assert.strictEqual(syncError.value, 20);
assert.strictEqual(syncError.value, asyncError.value);
