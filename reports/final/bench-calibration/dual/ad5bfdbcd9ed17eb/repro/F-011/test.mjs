import assert from 'node:assert/strict';
import { buildSummary } from './src/ledger.ts';
const first = buildSummary([{ account: 'sales', cents: 200 }]);
assert.equal(first, 'sales=200');
const second = buildSummary([{ account: 'sales', cents: 300 }]);
assert.equal(second, 'sales=300');
