import assert from 'node:assert/strict'
import CssSyntaxError from './css-syntax-error.js'

const longLine = 'a'.repeat(200)
const error = new CssSyntaxError('Test error', 1, 100, longLine)
let output = ''
let thrown = null
try {
  output = error.showSourceCode(false)
} catch (e) {
  thrown = e
}
assert.equal(thrown, null)
assert.ok(
  output.includes('a'.repeat(40)),
  `expected 40-char snippet around column 100, got: ${JSON.stringify(output)}`
)
assert.ok(output.includes('^'))
