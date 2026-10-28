import assert from 'node:assert/strict';
import { rotateAndRead } from './helpers/session.js';

let token = 'old';
const store = {
  async save(obj) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    token = obj.token;
  },
  get(key) {
    return key === 'token' ? token : undefined;
  },
};

let result;
let error = null;
try {
  result = await rotateAndRead(store);
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.equal(result, 'next');
