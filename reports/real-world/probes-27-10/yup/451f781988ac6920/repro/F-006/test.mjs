import assert from 'node:assert/strict';
import { create } from './number.ts';

const schema = create().truncate();
let error;
let small;
let large;
let negativeLarge;
let huge;
try {
  small = schema.cast(-12.9);
  large = schema.cast(2147483648.9);
  negativeLarge = schema.cast(-2147483649.9);
  huge = schema.cast(4294967297.8);
} catch (caught) {
  error = caught;
}
assert.equal(error, undefined);
assert.equal(small, Math.trunc(-12.9));
assert.equal(large, Math.trunc(2147483648.9));
assert.equal(negativeLarge, Math.trunc(-2147483649.9));
assert.equal(huge, Math.trunc(4294967297.8));
