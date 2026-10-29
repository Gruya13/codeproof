import assert from 'node:assert/strict';
import { withinQuota } from './src/quota.ts';
const result = withinQuota(2, 3, 10);
assert.equal(result, true);
