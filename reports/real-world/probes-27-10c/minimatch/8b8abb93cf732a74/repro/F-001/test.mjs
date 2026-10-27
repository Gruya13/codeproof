import assert from 'node:assert/strict';
import { AST } from './ast.ts';

const pattern = AST.fromGlob('!(a|)').toMMPattern();
assert.equal(pattern instanceof RegExp, true);
assert.equal(pattern.test('a'), false);
assert.equal(pattern.test(''), false);
assert.equal(pattern.test('b'), true);
assert.equal(pattern.test('aa'), true);

const empty = AST.fromGlob('!()').toMMPattern();
assert.equal(empty instanceof RegExp, true);
assert.equal(empty.test('a'), true);
assert.equal(empty.test(''), false);

const negA = AST.fromGlob('!(a)').toMMPattern();
assert.equal(negA instanceof RegExp, true);
assert.equal(negA.test('a'), false);
assert.equal(negA.test(''), true);
assert.equal(negA.test('b'), true);
