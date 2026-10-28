import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';
let stored = 'stale-token';
const store = {
  async save(userId, token) { await new Promise((r) => setTimeout(r, 20)); stored = token; },
  async get(userId) { return stored; }
};
const result = await rotateToken(store, 'bob', 'rotated-token');
assert.equal(result, 'rotated-token');
