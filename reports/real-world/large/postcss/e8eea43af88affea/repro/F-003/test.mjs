import assert from 'node:assert/strict'
import postcss from './postcss.js'

const input = 'a { color: red; }\n/*# sourceMappingURL=old.css.map */'
const result = postcss([]).process(input, { from: 'input.css', map: false })

assert.equal(result.css.includes('sourceMappingURL'), false)
assert.equal(result.css === input, false)
assert.equal(result.toString(), result.css)
assert.equal(String(result), result.css)
