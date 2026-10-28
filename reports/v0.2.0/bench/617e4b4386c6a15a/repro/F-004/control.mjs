import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';
let stored = 'old-token';
const store = {
  async save(userId, token) { stored = token; },
  async get(userId) { return stored; }
};
const result = await rotateToken(store, 'alice', 'fresh-token');
assert.equal(result, 'fresh-token');
