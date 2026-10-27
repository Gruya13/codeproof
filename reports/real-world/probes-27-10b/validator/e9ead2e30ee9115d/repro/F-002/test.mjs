import assert from 'node:assert/strict';
import isCreditCard from './lib/isCreditCard.js';

// Controls: genuine 16-digit Luhn-valid Mastercards must pass.
assert.equal(isCreditCard('5105105105105100', { provider: 'mastercard' }), true);
assert.equal(isCreditCard('2221000000000009', { provider: 'mastercard' }), true);

// Prefix branch bug: ^5[1-5][0-9]{2} has no $ anchor.
// '510008' is Luhn-valid (sum 10) and starts 5100, but is only 6 digits.
assert.equal(isCreditCard('510008', { provider: 'mastercard' }), false);
// '51051051051051005' is Luhn-valid (sum 30) and starts 5105, but is 17 digits.
assert.equal(isCreditCard('51051051051051005', { provider: 'mastercard' }), false);

// Suffix branch bug: second alternative has no ^ anchor.
// '92221000000000000' is Luhn-valid (sum 20), 17 digits starting with 9,
// but ends with 2221 + 12 digits, so the unanchored branch matches.
assert.equal(isCreditCard('92221000000000000', { provider: 'mastercard' }), false);
