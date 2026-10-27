import assert from 'node:assert/strict';
import { _Parser } from './Parser.ts';

function makeParser() {
  return new _Parser({
    extensions: {
      renderers: {
        unknownBlock() { return false; },
        unknownInline() { return false; },
      },
    },
  });
}

let blockError = null;
let blockResult;
try {
  blockResult = makeParser().parse([{ type: 'unknownBlock', raw: 'x' }]);
} catch (err) {
  blockError = err;
}
assert.ok(blockError instanceof Error, `unknown block token returning false should throw, got ${JSON.stringify(blockResult)}`);
assert.match(blockError.message, /Token with "unknownBlock" type was not found\./);

let inlineError = null;
let inlineResult;
try {
  inlineResult = makeParser().parseInline([{ type: 'unknownInline', raw: 'x' }]);
} catch (err) {
  inlineError = err;
}
assert.ok(inlineError instanceof Error, `unknown inline token returning false should throw, got ${JSON.stringify(inlineResult)}`);
assert.match(inlineError.message, /Token with "unknownInline" type was not found\./);
