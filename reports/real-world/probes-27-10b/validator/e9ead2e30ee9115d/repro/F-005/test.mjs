import assert from 'node:assert/strict';
import isCurrency from './lib/isCurrency.js';

function check(str, options) {
  let result;
  let error = null;
  try {
    result = isCurrency(str, options);
  } catch (e) {
    error = e;
  }
  return { result, error };
}

let validDoubleDollar = check('$$10.00', { symbol: '$$', require_symbol: true });
assert.equal(validDoubleDollar.error, null);
assert.equal(validDoubleDollar.result, true);

let wildcardBypass = check('.a10.00', { symbol: '..', require_symbol: true });
assert.equal(wildcardBypass.error, null);
assert.equal(wildcardBypass.result, false);

let validPlus = check('$+10.00', { symbol: '$+', require_symbol: true });
assert.equal(validPlus.error, null);
assert.equal(validPlus.result, true);

let missingPlus = check('$10.00', { symbol: '$+', require_symbol: true });
assert.equal(missingPlus.error, null);
assert.equal(missingPlus.result, false);
