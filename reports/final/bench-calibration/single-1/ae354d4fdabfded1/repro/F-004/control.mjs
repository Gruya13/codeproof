import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';

let stored = 'old-control-token';
const store = {
  async save(userId, token) { stored = token; },
  async get(userId) { return stored; }
};
const result = await rotateToken(store, 'control-user', 'new-control-token');
assert.equal(result, 'new-control-token');
