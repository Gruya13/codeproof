import assert from 'node:assert/strict';
import { createScheduler } from './helpers/scheduler.js';

const origSetInterval = globalThis.setInterval;
const origClearInterval = globalThis.clearInterval;
const created = [];
const cleared = [];
globalThis.setInterval = (cb, ms, ...args) => {
  const handle = origSetInterval(cb, ms, ...args);
  created.push(handle);
  return handle;
};
globalThis.clearInterval = (handle) => {
  cleared.push(handle);
  return origClearInterval(handle);
};
const scheduler = createScheduler();
scheduler.start(() => {}, 100);
const first = scheduler.timer;
scheduler.start(() => {}, 100);
const second = scheduler.timer;
const firstClearedOnRestart = cleared.includes(first);
const distinct = first !== second;
globalThis.setInterval = origSetInterval;
globalThis.clearInterval = origClearInterval;
for (const h of created) origClearInterval(h);
scheduler.timer = null;
assert.strictEqual(distinct, true);
assert.strictEqual(firstClearedOnRestart, true, 'start() must clear previous interval before replacing timer');
