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
  } catch (err) {
    result.thrown = err;
  }
  return result;
}

const validate = (s) => s >= 200 && s < 300;

for (const status of [400, 403, 404, 422, 499]) {
  const r = run(status, validate);
  assert.equal(r.thrown, null);
  assert.equal(r.type, 'rejected', `status ${status} should reject when validateStatus returns false`);
  assert.equal(r.value && r.value.message, `Request failed with status code ${status}`);
}

const ok = run(200, validate);
assert.equal(ok.thrown, null);
assert.equal(ok.type, 'resolved');

const accepted404 = run(404, () => true);
assert.equal(accepted404.thrown, null);
assert.equal(accepted404.type, 'resolved');

const serverError = run(500, validate);
assert.equal(serverError.thrown, null);
assert.equal(serverError.type, 'rejected');
