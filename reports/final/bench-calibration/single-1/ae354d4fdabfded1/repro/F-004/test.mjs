import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';

let stored = 'old-test-token';
const store = {
  async save(userId, token) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    stored = token;
  },
  async get(userId) { return stored; }
};
const result = await rotateToken(store, 'test-user', 'new-test-token');
assert.equal(result, 'new-test-token');
