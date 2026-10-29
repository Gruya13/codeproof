import assert from 'node:assert/strict';
import { buildSummary, resetTotals } from './src/ledger.ts';
resetTotals();
const result = buildSummary([{ account: 'checking', cents: 100 }]);
assert.equal(result, 'checking=100');
