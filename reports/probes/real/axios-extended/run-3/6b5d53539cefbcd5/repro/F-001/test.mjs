import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const { token, cancel } = CancelToken.source();
assert.equal(token.reason, undefined);
cancel('Operation canceled by test');
assert.ok(token.reason, 'first cancel() should set token.reason');
assert.equal(token.reason.message, 'Operation canceled by test');

let thrown = null;
try {
  token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, token.reason);

let notified = null;
token.subscribe((reason) => { notified = reason; });
assert.equal(notified, token.reason);

cancel('second cancel should be ignored');
assert.equal(token.reason.message, 'Operation canceled by test');

const resolved = await token.promise;
assert.equal(resolved, token.reason);

const source2 = CancelToken.source();
let notified2 = null;
source2.token.subscribe((reason) => { notified2 = reason; });
source2.cancel('second token canceled');
assert.ok(source2.token.reason, 'first cancel() on second token should set reason');
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(notified2, source2.token.reason);
