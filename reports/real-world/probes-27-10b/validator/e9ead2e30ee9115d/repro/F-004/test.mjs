import assert from 'node:assert/strict';
import isLicensePlate from './lib/isLicensePlate.js';

// Valid pt-BR plates must pass
assert.equal(isLicensePlate('ABC1234', 'pt-BR'), true);
assert.equal(isLicensePlate('ABC-1234', 'pt-BR'), true);
assert.equal(isLicensePlate('ABC1D23', 'pt-BR'), true);
assert.equal(isLicensePlate('ABC-1D23', 'pt-BR'), true);

// Extra suffix after Mercosur format must be rejected (first branch lacks $)
assert.equal(isLicensePlate('ABC1D23X', 'pt-BR'), false);
assert.equal(isLicensePlate('ABC1D234', 'pt-BR'), false);
assert.equal(isLicensePlate('ABC1D23XYZ', 'pt-BR'), false);

// Extra prefix before old format must be rejected (second branch lacks ^)
assert.equal(isLicensePlate('XABC1234', 'pt-BR'), false);
assert.equal(isLicensePlate('XYZABC1234', 'pt-BR'), false);
assert.equal(isLicensePlate('1ABC1234', 'pt-BR'), false);
assert.equal(isLicensePlate(' ABC1234', 'pt-BR'), false);
