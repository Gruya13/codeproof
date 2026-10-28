import assert from 'node:assert/strict';
import AxiosHeaders from './core/AxiosHeaders.js';

const headers = new AxiosHeaders();
headers['content-type'] = 'first';
headers['Content-Type'] = 'second';
headers.normalize(true);

assert.equal(headers.has('Content-Type'), true);
assert.notEqual(headers.get('Content-Type'), undefined);
assert.equal(typeof headers.get('Content-Type'), 'string');
assert.deepEqual(Object.keys(headers.toJSON()), ['Content-Type']);
