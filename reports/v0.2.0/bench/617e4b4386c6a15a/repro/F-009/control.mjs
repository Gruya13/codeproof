import assert from 'node:assert/strict';
import { normalizeSettings } from './src/settings.ts';
const result = normalizeSettings({ pageSize: 10, budgetCents: 500 });
assert.equal(result.pageSize, 10);
assert.equal(result.budgetCents, 500);
const defaults = normalizeSettings({});
assert.equal(defaults.pageSize, 20);
assert.equal(defaults.budgetCents, 1000);
