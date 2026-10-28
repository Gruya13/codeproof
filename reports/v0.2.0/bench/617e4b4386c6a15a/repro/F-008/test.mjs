import assert from 'node:assert/strict';
import { withinQuota } from './src/quota.ts';
const result = withinQuota(5, 5, 10);
assert.equal(result, true);
const exact = withinQuota(0, 10, 10);
assert.equal(exact, true);
