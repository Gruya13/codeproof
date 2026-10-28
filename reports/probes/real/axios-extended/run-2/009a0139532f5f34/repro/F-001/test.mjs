import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const source = CancelToken.source();
assert.equal(source.token.reason, undefined);
source.cancel('Operation canceled by test');
assert.ok(source.token.reason);
assert.equal(source.token.reason.message, 'Operation canceled by test');

let thrown = null;
try {
  source.token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, source.token.reason);

let subscribed = null;
source.token.subscribe((reason) => { subscribed = reason; });
assert.equal(subscribed, source.token.reason);

source.cancel('second cancellation should be ignored');
assert.equal(source.token.reason.message, 'Operation canceled by test');
