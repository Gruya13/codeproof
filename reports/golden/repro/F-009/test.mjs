import assert from 'node:assert/strict';
import { normalizeSettings } from './src/settings.ts';

assert.deepEqual(normalizeSettings({ pageSize: 0, budgetCents: 0 }), { pageSize: 0, budgetCents: 0 });
assert.equal(normalizeSettings({ pageSize: 0 }).pageSize, 0);
assert.equal(normalizeSettings({ budgetCents: 0 }).budgetCents, 0);
assert.deepEqual(normalizeSettings({}), { pageSize: 20, budgetCents: 1000 });
assert.deepEqual(normalizeSettings({ pageSize: 5, budgetCents: 250 }), { pageSize: 5, budgetCents: 250 });
