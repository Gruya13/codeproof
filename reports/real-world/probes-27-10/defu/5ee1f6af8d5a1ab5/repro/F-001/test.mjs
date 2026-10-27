import assert from "node:assert/strict";
import { defu, defuFn, defuArrayFn } from "./defu.ts";

// Contract from types.ts DefuInstance: fn, arrayFn and extend must be functions.
assert.equal(typeof defu.fn, "function");
assert.equal(typeof defu.arrayFn, "function");
assert.equal(typeof defu.extend, "function");

// Baseline defu behaviour still holds.
assert.deepEqual(defu({ a: 1 }, { a: 2, b: 2 }), { a: 1, b: 2 });

// defu.fn must behave like defuFn: call function source values with defaults.
const inc = (v) => v + 1;
assert.deepEqual(defu.fn({ count: inc }, { count: 41 }), { count: 42 });
assert.deepEqual(defu.fn({ count: inc }, { count: 41 }), defuFn({ count: inc }, { count: 41 }));

// defu.arrayFn must behave like defuArrayFn: call functions for array defaults.
const append = (v) => [...v, 4];
assert.deepEqual(defu.arrayFn({ list: append }, { list: [1, 2, 3] }), { list: [1, 2, 3, 4] });
assert.deepEqual(
  defu.arrayFn({ list: append }, { list: [1, 2, 3] }),
  defuArrayFn({ list: append }, { list: [1, 2, 3] }),
);

// defu.extend must return a defu function using the supplied merger.
const custom = defu.extend((obj, key, value) => {
  if (typeof value === "string") {
    obj[key] = value.toUpperCase();
    return true;
  }
});
assert.equal(typeof custom, "function");
assert.deepEqual(custom({ name: "hi" }, { name: "bye", extra: 1 }), { name: "HI", extra: 1 });
assert.deepEqual(defu.extend()({ a: 1 }, { a: 2, b: 2 }), { a: 1, b: 2 });
