import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';

let stored = 'old-token';
const store = {
  async save(userId, token) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    stored = token;
  },
  async get(userId) {
    return stored;
  },
};

const result = await rotateToken(store, 'user-1', 'new-token');
assert.equal(result, 'new-token');
assert.equal(stored, 'new-token');
