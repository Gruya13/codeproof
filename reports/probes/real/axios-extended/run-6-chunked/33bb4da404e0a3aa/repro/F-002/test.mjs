import assert from 'node:assert/strict';
import utils from './utils.js';

const { toFlatObject } = utils;

const source = {
  constructor: 'own-constructor',
  toString: 'own-toString',
  hasOwnProperty: 'own-hasOwnProperty',
  valueOf: 'own-valueOf',
  normal: 42,
};

const dest = toFlatObject(source);
assert.equal(Object.prototype.hasOwnProperty.call(dest, 'constructor'), true);
assert.equal(dest.constructor, 'own-constructor');
assert.equal(Object.prototype.hasOwnProperty.call(dest, 'toString'), true);
assert.equal(dest.toString, 'own-toString');
assert.equal(Object.prototype.hasOwnProperty.call(dest, 'hasOwnProperty'), true);
assert.equal(dest.hasOwnProperty, 'own-hasOwnProperty');
assert.equal(Object.prototype.hasOwnProperty.call(dest, 'valueOf'), true);
assert.equal(dest.valueOf, 'own-valueOf');
assert.equal(dest.normal, 42);

const proto = { toString: 'proto-toString', inherited: 'yes' };
const chained = Object.create(proto);
chained.own = 1;
const dest2 = toFlatObject(chained);
assert.equal(dest2.own, 1);
assert.equal(dest2.inherited, 'yes');
assert.equal(Object.prototype.hasOwnProperty.call(dest2, 'toString'), true);
assert.equal(dest2.toString, 'proto-toString');
