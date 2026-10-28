import assert from 'node:assert/strict';
import throttle from './helpers/throttle.js';

const calls = [];
const [throttled] = throttle((...args) => calls.push(args), 20);
throttled('first');
throttled('second');
throttled('third');
await new Promise((resolve) => setTimeout(resolve, 120));
assert.deepEqual(calls, [['first'], ['third']]);
