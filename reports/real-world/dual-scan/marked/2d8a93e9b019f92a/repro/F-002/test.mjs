import assert from 'node:assert/strict';
import { _Lexer } from './Lexer.ts';

const lexer = new _Lexer();
const first = lexer.lex('# Alpha\n\n[a]: /first\n');
const firstTypes = first.map((token) => token.type);
assert.ok(firstTypes.includes('heading'));
assert.deepEqual(Object.keys(first.links), ['a']);

const second = lexer.lex('# Beta\n');
assert.equal(second.length, 1);
assert.equal(second[0].type, 'heading');
assert.equal(second[0].text, 'Beta');
assert.deepEqual(Object.keys(second.links), []);
