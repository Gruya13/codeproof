import assert from 'node:assert/strict';
import parseHeaders from './helpers/parseHeaders.js';

const cookies = parseHeaders('Set-Cookie: a=1\nSET-COOKIE: b=2');
assert.deepEqual(cookies['set-cookie'], ['a=1', 'b=2']);
assert.deepEqual(Object.keys(cookies), ['set-cookie']);

const dup = parseHeaders('Content-Type: text/html\ncontent-type: application/json');
assert.equal(dup['content-type'], 'text/html');
assert.deepEqual(Object.keys(dup), ['content-type']);

const merged = parseHeaders('X-Custom: 1\nx-custom: 2');
assert.equal(merged['x-custom'], '1, 2');
assert.deepEqual(Object.keys(merged), ['x-custom']);
