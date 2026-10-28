import assert from 'node:assert/strict';
import utils from './utils.js';

const { toObjectSet } = utils;

const present = toObjectSet(['alpha', 'beta']);
assert.equal(present.alpha, true);
assert.equal(present.beta, true);
assert.equal(present.gamma, undefined);

const empty = toObjectSet([]);
assert.equal(empty.toString, undefined);
assert.equal(empty.constructor, undefined);
assert.equal(empty.hasOwnProperty, undefined);
assert.equal(empty.valueOf, undefined);

const protoSet = toObjectSet(['__proto__']);
assert.equal(Object.prototype.hasOwnProperty.call(protoSet, '__proto__'), true);
assert.equal(protoSet['__proto__'], true);
assert.deepEqual(Object.keys(protoSet), ['__proto__']);

const fromString = toObjectSet('__proto__,constructor', ',');
assert.equal(Object.prototype.hasOwnProperty.call(fromString, '__proto__'), true);
assert.equal(fromString['__proto__'], true);
assert.equal(fromString.constructor, true);
assert.deepEqual(Object.keys(fromString).sort(), ['__proto__', 'constructor']);
