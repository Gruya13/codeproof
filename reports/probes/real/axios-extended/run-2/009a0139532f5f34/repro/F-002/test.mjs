import assert from 'node:assert/strict';
import settle from './core/settle.js';

function run(status, validateStatus) {
  let outcome = null;
  let value = null;
  let error = null;
  try {
    settle(
      (res) => { outcome = 'resolved'; value = res; },
      (err) => { outcome = 'rejected'; error = err; },
      { status, config: { validateStatus }, request: {} }
    );
  } catch (e) {
    outcome = 'threw';
    error = e;
  }
  return { outcome, value, error };
}

const ok = run(200, (s) => s >= 200 && s < 300);
assert.equal(ok.outcome, 'resolved');
assert.equal(ok.value.status, 200);

const r404 = run(404, (s) => s >= 200 && s < 300);
assert.equal(r404.outcome, 'rejected');
assert.ok(r404.error);
assert.match(String(r404.error.message), /404/);

const r403 = run(403, () => false);
assert.equal(r403.outcome, 'rejected');
assert.ok(r403.error);

const r301 = run(301, () => false);
assert.equal(r301.outcome, 'rejected');
assert.ok(r301.error);
