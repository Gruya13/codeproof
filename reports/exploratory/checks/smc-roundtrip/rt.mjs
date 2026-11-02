import { encodeOriginalScopes, decodeOriginalScopes } from './scopes.ts';

function scope(tuple) { const s = tuple.slice(); s.vars = []; return s; }

// Case A: one top-level scope (the shape covered by the upstream tests in test/scopes.test.ts)
const one = [scope([0, 0, 5, 10, 1])];
const encOne = encodeOriginalScopes(one);
const decOne = decodeOriginalScopes(encOne);
console.log("one top-level: encoded=" + JSON.stringify(encOne) + " decoded=" + JSON.stringify(decOne) + " roundtrip=" + (JSON.stringify(decOne) === JSON.stringify(one)));

// Case B: two top-level scopes (not covered by the upstream tests)
const two = [scope([0, 0, 5, 10, 1]), scope([6, 0, 10, 10, 1])];
const encTwo = encodeOriginalScopes(two);
const decTwo = decodeOriginalScopes(encTwo);
console.log("two top-level: encoded=" + JSON.stringify(encTwo) + " decoded=" + JSON.stringify(decTwo) + " roundtrip=" + (JSON.stringify(decTwo) === JSON.stringify(two)));
