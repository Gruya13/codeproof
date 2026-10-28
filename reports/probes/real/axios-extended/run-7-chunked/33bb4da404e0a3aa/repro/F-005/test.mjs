import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const { token, cancel } = CancelToken.source();
assert.equal(token.reason, undefined);
cancel('Operation canceled by test');
assert.ok(token.reason, 'cancel() should set token.reason on first call');
assert.equal(token.reason.message, 'Operation canceled by test');
assert.equal(token.reason.name, 'CanceledError');

let thrown = null;
try {
  token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.ok(thrown, 'throwIfRequested() should throw after cancellation');
assert.equal(thrown, token.reason);

let notified = null;
token.subscribe((reason) => { notified = reason; });
assert.equal(notified, token.reason);

const resolved = await token.promise;
assert.equal(resolved, token.reason);

cancel('second cancellation');
assert.equal(token.reason.message, 'Operation canceled by test');
