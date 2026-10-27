import assert from 'node:assert/strict';
import slugify from './index.js';

let sepError = null;
let sepResult;
try {
  sepResult = slugify('foo bar baz', {separator: '\\'});
} catch (error) {
  sepError = error;
}
assert.equal(sepError, null);
assert.equal(sepResult, 'foo\\bar\\baz');

let preserveError = null;
let preserveResult;
try {
  preserveResult = slugify('foo\\bar baz', {preserveCharacters: ['\\'], transliterate: false});
} catch (error) {
  preserveError = error;
}
assert.equal(preserveError, null);
assert.equal(preserveResult, 'foo\\bar-baz');
