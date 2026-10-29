import assert from 'node:assert/strict';
import { assertionTiedToSymbols } from './repro/static-checks.mjs';
let caught = null;
var result = null;
try {
  var result = assertionTiedToSymbols("assert.equal(toString(value), 'x');", ["toString"]);
} catch (error) {
  caught = error;
}
assert.equal(result !== null && caught === null, true);
assert.equal(result?.ok, true);
assert.equal(result?.via, "direct");
assert.equal(result?.symbol, "toString");
