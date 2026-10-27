import assert from 'node:assert/strict';
import sortByKeyOrder from './util/sortByKeyOrder.ts';

const byOrder = sortByKeyOrder(['name', 'age']);
const username = { path: 'username' };
const age = { path: 'age' };
const message = { path: 'message' };
const name = { path: 'name' };

// 'username' only contains 'name' as a substring, not an exact path,
// so it is unmatched and must sort after the exact 'age' key.
assert.equal(Math.sign(byOrder(username, age)), 1);
assert.equal(Math.sign(byOrder(age, username)), -1);
assert.deepEqual(
  [username, age].sort(byOrder).map((e) => e.path),
  ['age', 'username'],
);

// 'message' only contains 'age' as a substring, so it must sort after 'age'.
assert.equal(Math.sign(byOrder(message, age)), 1);
assert.deepEqual(
  [message, age].sort(byOrder).map((e) => e.path),
  ['age', 'message'],
);

// Exact matches still sort by the declared key order.
assert.deepEqual(
  [age, name].sort(byOrder).map((e) => e.path),
  ['name', 'age'],
);
