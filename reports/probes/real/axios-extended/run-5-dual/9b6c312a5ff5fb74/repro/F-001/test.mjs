import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const { token, cancel } = CancelToken.source();
assert.equal(token.reason, undefined);

cancel('Operation canceled by test');

assert.ok(token.reason);
assert.equal(token.reason.message, 'Operation canceled by test');

let thrown = null;
try {
  token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, token.reason);

let notified = null;
token.subscribe((reason) => {
  notified = reason;
});
assert.equal(notified, token.reason);

const firstReason = token.reason;
cancel('second cancel');
assert.equal(token.reason, firstReason);
assert.equal(token.reason.message, 'Operation canceled by test');
