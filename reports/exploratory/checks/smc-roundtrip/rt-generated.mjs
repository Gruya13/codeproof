import { encodeGeneratedRanges, decodeGeneratedRanges } from './scopes.ts';
import { strict as assert } from 'node:assert';

// Minimal generated range: [startLine, startColumn, endLine, endColumn]
// One binding whose expression ranges move to different lines (2 then 4).
const range = [0, 0, 4, 10];
range.isScope = false;
range.callsite = null;
range.bindings = [[[0], [0, 2, 5], [0, 4, 9]]];
const ranges = [range];

const encoded = encodeGeneratedRanges(ranges);
const decoded = decodeGeneratedRanges(encoded);
console.log("encoded=" + JSON.stringify(encoded));
console.log("original binding = " + JSON.stringify(range.bindings));
console.log("decoded  binding = " + JSON.stringify(decoded[0] && decoded[0].bindings));
try {
  assert.deepEqual(decoded[0].bindings, range.bindings);
  console.log("roundtrip=true");
} catch (error) {
  console.log("roundtrip=false");
}
