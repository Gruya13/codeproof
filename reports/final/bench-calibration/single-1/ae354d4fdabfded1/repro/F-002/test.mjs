import assert from 'node:assert/strict';
import { buildSummary, resetTotals } from './src/ledger.ts';
resetTotals();
const first = buildSummary([{ account: 'savings', cents: 50 }]);
assert.equal(first, 'savings=50');
const second = buildSummary([{ account: 'savings', cents: 30 }]);
assert.equal(second, 'savings=30');
