import assert from 'node:assert/strict';
import settle from './core/settle.js';

function run(status, validateStatus) {
  let outcome = null;
  let error = null;
  let value = null;
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
  return { outcome, error, value };
}

// Custom validateStatus accepts only 2xx, so 404 must reject (not resolve).
const r404 = run(404, (s) => s >= 200 && s < 300);
assert.equal(r404.outcome, 'rejected');
assert.equal(r404.error && r404.error.response && r404.error.response.status, 404);

// A validateStatus accepting only 200 must reject 403.
const r403 = run(403, (s) => s === 200);
assert.equal(r403.outcome, 'rejected');

// Sanity: a status accepted by validateStatus resolves.
const ok = run(200, (s) => s >= 200 && s < 300);
assert.equal(ok.outcome, 'resolved');
