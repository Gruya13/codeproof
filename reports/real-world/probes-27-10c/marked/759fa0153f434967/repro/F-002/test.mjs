import assert from 'node:assert/strict';
import { _Lexer } from './Lexer.ts';

let caught = null;
let tokens;
try {
  const lexer = new _Lexer();
  // Simulate Tokenizer.list lexing an outer list item: it sets top=false
  // before calling blockTokens for the item's contents.
  lexer.state.top = false;
  tokens = lexer.blockTokens('- inner\n\ntail', []);
} catch (err) {
  caught = err;
}

assert.equal(caught, null);
assert.ok(tokens);
assert.equal(tokens[0]?.type, 'list');
const tail = tokens.find((token) => token.text === 'tail');
assert.ok(tail, 'tail should be lexed as a separate token after the nested list');
assert.equal(tail.type, 'text');
