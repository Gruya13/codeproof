import assert from 'node:assert/strict';
import { normalizeSettings } from './src/settings.ts';
const result = normalizeSettings({ pageSize: 5, budgetCents: 250 });
assert.equal(result.pageSize, 5);
assert.equal(result.budgetCents, 250);
