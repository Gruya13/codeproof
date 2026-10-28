import assert from 'node:assert/strict';
import { createScheduler } from './helpers/scheduler.js';

const origSetInterval = globalThis.setInterval;
const origClearInterval = globalThis.clearInterval;
let nextId = 1;
const cleared = [];
const active = new Set();
globalThis.setInterval = (cb, ms) => {
  const id = nextId++;
  active.add(id);
  return id;
};
globalThis.clearInterval = (id) => {
  cleared.push(id);
  active.delete(id);
};
let first;
let second;
let clearedAfterSecond;
let activeAfterSecond;
let caught = null;
try {
  const scheduler = createScheduler();
  scheduler.start(() => {}, 10);
  first = scheduler.timer;
  scheduler.start(() => {}, 10);
  second = scheduler.timer;
  clearedAfterSecond = [...cleared];
  activeAfterSecond = new Set(active);
  scheduler.stop();
} catch (e) {
  caught = e;
} finally {
  globalThis.setInterval = origSetInterval;
  globalThis.clearInterval = origClearInterval;
}
assert.equal(caught, null);
assert.notEqual(first, undefined);
assert.notEqual(first, second);
assert.ok(
  clearedAfterSecond.includes(first),
  `first timer ${first} should be cleared when start() replaces it, cleared=${JSON.stringify(clearedAfterSecond)}`
);
assert.equal(activeAfterSecond.size, 1);
assert.ok(activeAfterSecond.has(second));
