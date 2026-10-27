import assert from 'node:assert/strict';
import slugify from './index.js';

// A separator containing `$&` must be inserted literally when
// repeated separators are collapsed to a single separator.
assert.equal(
  slugify('foo$&$&bar', {separator: '$&', transliterate: false}),
  'foo$&bar',
);
assert.equal(
  slugify('foo$&$&$&bar', {separator: '$&', transliterate: false}),
  'foo$&bar',
);
assert.equal(
  slugify('foo$&$&bar$&$&baz', {separator: '$&', transliterate: false}),
  'foo$&bar$&baz',
);
