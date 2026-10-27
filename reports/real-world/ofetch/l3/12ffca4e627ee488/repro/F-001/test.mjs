import assert from 'node:assert/strict';
import { isJSONSerializable } from './src/utils.ts';

// null is valid JSON (JSON.stringify(null) === 'null') and the early-return
// branch was intended to include it, so it must return true, not throw.
assert.equal(isJSONSerializable(null), true);
assert.equal(isJSONSerializable('x'), true);
assert.equal(isJSONSerializable(42), true);
assert.equal(isJSONSerializable(true), true);
assert.equal(isJSONSerializable(undefined), false);
