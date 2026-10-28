import assert from 'node:assert/strict';
import InterceptorManager from './core/InterceptorManager.js';

const manager = new InterceptorManager();
function fulfilledA() {}
function fulfilledB() {}
function fulfilledC() {}
const idA = manager.use(fulfilledA);
const idB = manager.use(fulfilledB);
const idC = manager.use(fulfilledC);
assert.equal(typeof idA, 'number');
assert.equal(typeof idC, 'number');
manager.eject(idB);

const seen = [];
let caught = null;
try {
  manager.forEach((h) => {
    seen.push(h);
  });
} catch (err) {
  caught = err;
}
assert.equal(caught, null);
assert.equal(seen.length, 2);
assert.equal(seen.includes(null), false);
assert.deepEqual(seen.map((h) => h && h.fulfilled), [fulfilledA, fulfilledC]);
