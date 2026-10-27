import assert from 'node:assert/strict';
import slugify from './index.js';

// $& must be inserted literally, not expanded to the matched key 'x'.
// Literal '$&' contains no slug characters, so the result should be empty.
assert.strictEqual(
  slugify('x', {transliterate: false, customReplacements: [['x', '$&']]}),
  '',
);

// $' must be inserted literally, not expanded to the text after the match (' b').
assert.strictEqual(
  slugify('a x b', {transliterate: false, customReplacements: [['x', "$'"]]}),
  'a-b',
);

// $` must be inserted literally, not expanded to the text before the match ('a ').
assert.strictEqual(
  slugify('a x b', {transliterate: false, customReplacements: [['x', '$`']]}),
  'a-b',
);

// Repeated $& patterns must also stay literal.
assert.strictEqual(
  slugify('x', {transliterate: false, customReplacements: [['x', '$&-$&']]}),
  '',
);
