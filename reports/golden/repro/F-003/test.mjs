import assert from 'node:assert/strict';
import { buildSummary, resetTotals } from './src/ledger.ts';

resetTotals();
const entries = [
  { account: 'checking', cents: 100 },
  { account: 'savings', cents: 50 },
];
assert.equal(buildSummary(entries), 'checking=100,savings=50');
assert.equal(buildSummary(entries), 'checking=100,savings=50');
assert.equal(buildSummary([{ account: 'checking', cents: 25 }]), 'checking=25');
resetTotals();
