import assert from 'node:assert/strict'
import fromJSON from './fromJSON.js'
import Document from './document.js'

const json = {
  type: 'document',
  raws: {},
  nodes: [
    {
      type: 'root',
      raws: { after: '\n' },
      nodes: [
        {
          type: 'rule',
          selector: 'a',
          raws: { between: ' ' },
          nodes: [
            { type: 'decl', prop: 'color', value: 'red', raws: { between: ': ' } }
          ]
        }
      ]
    }
  ]
}

let result = null
let thrown = null
try {
  result = fromJSON(json)
} catch (error) {
  thrown = error
}

assert.equal(thrown, null)
assert.ok(result instanceof Document)
assert.equal(result.type, 'document')
assert.equal(result.nodes.length, 1)
assert.equal(result.first.type, 'root')
assert.equal(result.first.parent, result)
assert.equal(result.first.first.selector, 'a')
assert.equal(result.first.first.first.prop, 'color')
assert.equal(result.first.first.first.value, 'red')
