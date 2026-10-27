import assert from 'node:assert/strict';
import slugify from './index.js';

assert.equal(slugify('foo bar', {separator: '$&'}), 'foo$&bar');
assert.equal(slugify('foo bar', {separator: '$$'}), 'foo$$bar');
assert.equal(slugify('foo bar baz', {separator: "$'"}), "foo$'bar$'baz");
assert.equal(slugify('foo bar', {separator: '$`'}), 'foo$`bar');
assert.equal(slugify('foo bar', {separator: 'a$&b'}), 'fooa$&bbar');
