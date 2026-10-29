import assert from 'node:assert/strict';
import { assertionTiedToSymbols } from './repro/static-checks.mjs';
const result = assertionTiedToSymbols("assert.equal(page(items), 1);", ["page"]);
assert.equal(result.ok, true);
assert.equal(result.via, "direct");
assert.equal(result.symbol, "page");
