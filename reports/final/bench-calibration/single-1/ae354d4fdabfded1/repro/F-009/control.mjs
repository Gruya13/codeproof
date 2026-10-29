import assert from 'node:assert/strict';
import { withinQuota } from './src/quota.ts';
const result = withinQuota(0, 5, 10);
assert.equal(result, true);
