import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const source = CancelToken.source();
assert.equal(typeof source.cancel, 'function');
assert.equal(source.token.reason, undefined);

let promiseReason = null;
source.token.promise.then((reason) => { promiseReason = reason; });

source.cancel('first cancel');

assert.ok(source.token.reason);
assert.equal(source.token.reason.message, 'first cancel');

await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(promiseReason, source.token.reason);

let notified = null;
source.token.subscribe((reason) => { notified = reason; });
assert.equal(notified, source.token.reason);

let thrown = null;
try {
  source.token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, source.token.reason);

const firstReason = source.token.reason;
source.cancel('second cancel');
assert.equal(source.token.reason, firstReason);
assert.equal(source.token.reason.message, 'first cancel');
