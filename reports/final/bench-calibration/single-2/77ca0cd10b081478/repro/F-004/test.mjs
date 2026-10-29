import assert from 'node:assert/strict';
import { buildSummary, resetTotals } from './src/ledger.ts';
resetTotals();
const first = buildSummary([{ account: 'bob', cents: 50 }]);
assert.equal(first, 'bob=50');
const second = buildSummary([{ account: 'bob', cents: 30 }]);
assert.equal(second, 'bob=30');
