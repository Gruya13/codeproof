import assert from 'node:assert/strict';
import { buildSummary } from './src/ledger.ts';
const result = buildSummary([{ account: 'cash', cents: 500 }]);
assert.equal(result, 'cash=500');
