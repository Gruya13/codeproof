import assert from 'node:assert/strict';
import AxiosHeaders from './core/AxiosHeaders.js';

class SubHeaders extends AxiosHeaders {}

let error = null;
const custom = () => 'custom';
try {
  SubHeaders.accessor('X-Repro-One');
  Object.defineProperty(SubHeaders.prototype, 'getXReproOne', {
    value: custom,
    configurable: true,
    writable: true,
  });
  SubHeaders.accessor('X-Repro-Two');
  SubHeaders.accessor('X-Repro-One');
} catch (e) {
  error = e;
}

assert.equal(error, null);
assert.equal(typeof SubHeaders.prototype.getXReproTwo, 'function');
assert.equal(SubHeaders.prototype.getXReproOne, custom);

const headers = new SubHeaders();
headers.setXReproTwo('two-value');
assert.equal(headers.getXReproTwo(), 'two-value');
