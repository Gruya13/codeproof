import assert from 'node:assert/strict';
import settle from './core/settle.js';

function run(status, validateStatus) {
  let resolved = null;
  let rejected = null;
  let thrown = null;
  try {
    settle(
      (v) => { resolved = v; },
      (e) => { rejected = e; },
      { status, config: { validateStatus }, request: {} }
    );
  } catch (e) {
    thrown = e;
  }
  return { resolved, rejected, thrown };
}

const r404 = run(404, (s) => s >= 200 && s < 300);
assert.strictEqual(r404.thrown, null);
assert.strictEqual(r404.resolved, null);
assert.ok(r404.rejected);
assert.strictEqual(r404.rejected.response.status, 404);

const r400 = run(400, () => false);
assert.strictEqual(r400.thrown, null);
assert.strictEqual(r400.resolved, null);
assert.ok(r400.rejected);
assert.strictEqual(r400.rejected.response.status, 400);

const r200 = run(200, (s) => s >= 200 && s < 300);
assert.strictEqual(r200.thrown, null);
assert.ok(r200.resolved);
assert.strictEqual(r200.rejected, null);
