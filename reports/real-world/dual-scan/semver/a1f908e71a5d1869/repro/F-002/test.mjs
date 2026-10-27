import assert from 'node:assert/strict'
import SemVer from './classes/semver.js'

const original = new SemVer('1.2.3-alpha.1+build.42')
assert.deepEqual(original.build, ['build', '42'])
assert.equal(original.raw, '1.2.3-alpha.1+build.42')

let clonedLoose = null
let errLoose = null
try {
  clonedLoose = new SemVer(original, { loose: true })
} catch (e) {
  errLoose = e
}
assert.equal(errLoose, null)
assert.notEqual(clonedLoose, original)
assert.deepEqual(clonedLoose.build, ['build', '42'])
assert.equal(clonedLoose.raw, '1.2.3-alpha.1+build.42')
assert.deepEqual(clonedLoose.prerelease, ['alpha', 1])

let clonedPre = null
let errPre = null
try {
  clonedPre = new SemVer(original, { includePrerelease: true })
} catch (e) {
  errPre = e
}
assert.equal(errPre, null)
assert.notEqual(clonedPre, original)
assert.deepEqual(clonedPre.build, ['build', '42'])
assert.equal(clonedPre.raw, '1.2.3-alpha.1+build.42')
