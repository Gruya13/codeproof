import assert from 'node:assert/strict';
import { isISO6346 } from './lib/isISO6346.js';

// Valid IDs should be accepted.
assert.equal(isISO6346('CSQU3054383'), true);
assert.equal(isISO6346('ABCU1234560'), true);
assert.equal(isISO6346('ABCJ123456'), true);

// Extra suffix: first alternation branch lacks a trailing anchor.
assert.equal(isISO6346('ABCU1234560XYZ'), false);
assert.equal(isISO6346('ABCU1234567XYZ'), false);

// Extra prefix: second alternation branch lacks a leading anchor.
assert.equal(isISO6346('GARBAGEJ123456'), false);
assert.equal(isISO6346('XXXXZ1234567'), false);

// Comma: [J,Z] incorrectly includes a literal comma as category.
assert.equal(isISO6346('ABC,123456'), false);
assert.equal(isISO6346(',123456'), false);
