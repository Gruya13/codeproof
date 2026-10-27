import assert from 'node:assert/strict';
import { extractUsedImportedSymbols } from './repro/index.mjs';

const multilineOnly = [
  'import {',
  '  alphaSymbol,',
  '  betaSymbol',
  "} from './repro/index.mjs';",
  'const value = 42;',
  'assert.equal(value, 42);'
].join('\n');

assert.deepStrictEqual(extractUsedImportedSymbols(multilineOnly), []);

const multilineUsed = [
  'import {',
  '  alphaSymbol,',
  '  betaSymbol',
  "} from './repro/index.mjs';",
  'alphaSymbol(value);'
].join('\n');

assert.deepStrictEqual(extractUsedImportedSymbols(multilineUsed), ['alphaSymbol']);
