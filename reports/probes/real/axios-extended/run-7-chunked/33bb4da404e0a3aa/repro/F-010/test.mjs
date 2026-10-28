import assert from 'node:assert/strict';
import parseHeaders from './helpers/parseHeaders.js';

const cookies = parseHeaders('Set-Cookie: a=1\nSet-Cookie: b=2\nSET-COOKIE: c=3');
assert.deepEqual(cookies['set-cookie'], ['a=1', 'b=2', 'c=3']);
assert.deepEqual(Object.keys(cookies), ['set-cookie']);

const dup = parseHeaders('Content-Type: text/html\ncontent-type: application/json\nCONTENT-TYPE: text/plain');
assert.equal(dup['content-type'], 'text/html');
assert.deepEqual(Object.keys(dup), ['content-type']);

const merged = parseHeaders('X-Custom: a\nx-custom: b');
assert.equal(merged['x-custom'], 'a, b');
assert.deepEqual(Object.keys(merged), ['x-custom']);

const simple = parseHeaders('Date: Wed, 27 Aug 2014 08:58:49 GMT');
assert.equal(simple['date'], 'Wed, 27 Aug 2014 08:58:49 GMT');
assert.deepEqual(Object.keys(simple), ['date']);
