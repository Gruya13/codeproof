import assert from 'node:assert/strict';
import AxiosHeaders from './core/AxiosHeaders.js';

AxiosHeaders.accessor('X-Repro');
const firstGet = AxiosHeaders.prototype.getXRepro;
const firstSet = AxiosHeaders.prototype.setXRepro;
assert.equal(typeof firstGet, 'function');
assert.equal(typeof firstSet, 'function');

const headers = new AxiosHeaders();
headers.setXRepro('alpha');
assert.equal(headers.getXRepro(), 'alpha');
assert.equal(headers.get('X-Repro'), 'alpha');

AxiosHeaders.accessor('X-Other');
AxiosHeaders.accessor('X-Repro');

assert.equal(AxiosHeaders.prototype.getXRepro, firstGet);
assert.equal(AxiosHeaders.prototype.setXRepro, firstSet);
assert.equal(headers.getXRepro(), 'alpha');
