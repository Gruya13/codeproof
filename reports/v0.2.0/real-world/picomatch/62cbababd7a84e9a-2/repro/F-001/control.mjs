import assert from 'node:assert/strict';
import parse from './parse.js';

const result = parse('(a)');
assert.equal(result.parens, 0);
assert.equal(result.output, '(a)');
