import assert from 'node:assert/strict'
import LRUCache from './internal/lrucache.js'

const cache = new LRUCache()
cache.set('a', 1)
assert.equal(cache.get('a'), 1)
cache.set('a', 2)
assert.equal(cache.get('a'), 2)
cache.set('b', 10)
cache.set('b', 20)
assert.equal(cache.get('b'), 20)
assert.equal(cache.get('a'), 2)
