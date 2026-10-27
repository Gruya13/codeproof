import assert from 'node:assert/strict';
import { withinQuota } from './src/quota.ts';

// Exact-max requests must be within quota (max is inclusive)
assert.equal(withinQuota(0, 10, 10), true);
assert.equal(withinQuota(5, 5, 10), true);
assert.equal(withinQuota(10, 0, 10), true);
assert.equal(withinQuota(9, 1, 10), true);

// Below max is within quota, above max is not
assert.equal(withinQuota(0, 9, 10), true);
assert.equal(withinQuota(0, 11, 10), false);
assert.equal(withinQuota(6, 5, 10), false);
