import assert from 'node:assert/strict';
import settle from './core/settle.js';

function run(status, validateStatus) {
  const result = { type: null, value: null, thrown: null };
  try {
    settle(
      (res) => { result.type = 'resolved'; result.value = res; },
      (err) => { result.type = 'rejected'; result.value = err; },
      { status, config: { validateStatus }, request: {} }
    );
  } catch (e) {
    result.thrown = e;
    result.type = 'thrown';
  }
  return result;
}

const validate = (s) => s >= 200 && s < 300;

const ok = run(200, validate);
assert.equal(ok.thrown, null);
assert.equal(ok.type, 'resolved');

const notFound = run(404, validate);
assert.equal(notFound.thrown, null);
assert.equal(notFound.type, 'rejected');
assert.equal(notFound.value && notFound.value.code, 'ERR_BAD_REQUEST');
assert.match(notFound.value ? notFound.value.message : '', /404/);

const forbidden = run(403, validate);
assert.equal(forbidden.thrown, null);
assert.equal(forbidden.type, 'rejected');
assert.equal(forbidden.value && forbidden.value.code, 'ERR_BAD_REQUEST');
