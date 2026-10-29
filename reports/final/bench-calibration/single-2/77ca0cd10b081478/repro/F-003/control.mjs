import assert from 'node:assert/strict';
import { rotateToken } from './src/session.ts';

const data = new Map([['alice', 'old-control']]);
const store = {
  async save(userId, token) { data.set(userId, token); },
  async get(userId) { return data.get(userId); },
};
const result = await rotateToken(store, 'alice', 'new-control');
assert.equal(result, 'new-control');
