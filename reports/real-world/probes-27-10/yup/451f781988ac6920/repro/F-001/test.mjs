import assert from 'node:assert/strict';
import { string } from './src/index.ts';

const base = string().test({
  name: 'shared',
  message: 'base test',
  exclusive: false,
  test: () => true,
});
const other = string().test({
  name: 'shared',
  message: 'other test',
  exclusive: true,
  test: () => true,
});

assert.equal(base.exclusiveTests.shared, false);

const combined = base.concat(other);

assert.equal(combined.exclusiveTests.shared, true);
assert.notStrictEqual(combined.exclusiveTests, base.exclusiveTests);
assert.equal(base.exclusiveTests.shared, false);

const derived = base.test({
  name: 'shared',
  message: 'derived test',
  exclusive: false,
  test: () => true,
});
const sharedCount = derived.tests.filter(
  (fn) => fn.OPTIONS?.name === 'shared',
).length;
assert.equal(sharedCount, 2);
