import assert from 'node:assert/strict';
import { Scheduler } from './src/scheduler.ts';

const scheduler = new Scheduler();
let count = 0;
scheduler.subscribe(() => { count += 1; });
scheduler.start(10);
const firstTimer = scheduler.timer;
scheduler.start(500);
const secondTimer = scheduler.timer;
try {
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 0, 'second start() should clear the prior interval, so no ticks from the 10ms timer should fire');
} finally {
  clearInterval(firstTimer);
  clearInterval(secondTimer);
}
