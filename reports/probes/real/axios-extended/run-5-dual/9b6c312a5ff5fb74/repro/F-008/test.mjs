import assert from 'node:assert/strict';
import parseHeaders from './helpers/parseHeaders.js';

function valuesFor(parsed, lowerName) {
  return Object.keys(parsed)
    .filter((key) => key.toLowerCase() === lowerName)
    .map((key) => parsed[key]);
}

// ignoreDuplicateOf entries are lowercase, but raw headers commonly use
// capitalized names. Duplicates must be ignored (first value wins).
const contentType = parseHeaders(
  'Content-Type: text/html\nContent-Type: application/json'
);
assert.deepEqual(valuesFor(contentType, 'content-type'), ['text/html']);

const authorization = parseHeaders(
  'Authorization: Bearer first\nAuthorization: Bearer second'
);
assert.deepEqual(valuesFor(authorization, 'authorization'), ['Bearer first']);
