import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';
const data = new Map([['bob', 'old-b']]);
const store = {
  async save(userId, token) { await new Promise((resolve) => setTimeout(resolve, 50)); data.set(userId, token); },
  async get(userId) { return data.get(userId); },
};
const result = await rotateToken(store, 'bob', 'new-b');
assert.equal(result, 'new-b');
