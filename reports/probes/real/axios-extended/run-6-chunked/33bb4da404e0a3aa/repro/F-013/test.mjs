import assert from 'node:assert/strict';
import throttle from './helpers/throttle.js';

const calls = [];
const [throttled] = throttle((value) => calls.push(value), 100);

throttled('first');
throttled('second');
throttled('third');

await new Promise((resolve) => setTimeout(resolve, 50));

assert.deepEqual(calls, ['first', 'third']);
