import assert from 'node:assert/strict'
import LRUCache from './internal/lrucache.js'

const cache = new LRUCache()
cache.set('key', 'first')
assert.equal(cache.get('key'), 'first')
cache.set('key', 'second')
assert.equal(cache.get('key'), 'second')
assert.equal(cache.map.size, 1)
cache.set('other', 1)
cache.set('other', 2)
assert.equal(cache.get('other'), 2)
assert.equal(cache.get('key'), 'second')
