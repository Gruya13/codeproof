import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const source = CancelToken.source();
assert.equal(typeof source.cancel, 'function');
assert.equal(source.token.reason, undefined);

source.cancel('Operation canceled');

assert.ok(source.token.reason, 'first cancel() should set token.reason');
assert.equal(source.token.reason.message, 'Operation canceled');
assert.equal(source.token.reason.name, 'CanceledError');

let thrown = null;
try {
  source.token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, source.token.reason);

let notified = null;
source.token.subscribe((reason) => { notified = reason; });
assert.equal(notified, source.token.reason);

const resolved = await Promise.race([
  source.token.promise,
  new Promise((resolve) => setTimeout(() => resolve(null), 100)),
]);
assert.equal(resolved, source.token.reason);

source.cancel('second cancel should be ignored');
assert.equal(source.token.reason.message, 'Operation canceled');
