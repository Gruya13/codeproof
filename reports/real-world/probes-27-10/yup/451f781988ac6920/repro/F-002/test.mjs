import assert from 'node:assert/strict';
import Reference, { create } from './src/Reference.ts';

function attempt(fn) {
  let error = null;
  let value = null;
  try {
    value = fn();
  } catch (e) {
    error = e;
  }
  return { error, value };
}

// Control: empty string already throws the documented error.
{
  const { error } = attempt(() => new Reference(''));
  assert.ok(error instanceof TypeError, 'empty ref should throw TypeError');
  assert.equal(error.message, 'ref must be a non-empty string');
}

// Control: a normal key is trimmed and accepted.
{
  const { error, value } = attempt(() => new Reference(' foo '));
  assert.equal(error, null);
  assert.equal(value.key, 'foo');
}

// Whitespace-only keys trim to '' and must also throw.
for (const key of [' ', '   ', '\t', '\n', ' \t\n ']) {
  const { error, value } = attempt(() => new Reference(key));
  assert.ok(
    error instanceof TypeError,
    `whitespace-only ref ${JSON.stringify(key)} should throw TypeError, got value=${value && JSON.stringify(value.key)}`,
  );
  assert.equal(error.message, 'ref must be a non-empty string');
}

// The create() factory must enforce the same check.
{
  const { error } = attempt(() => create('   '));
  assert.ok(error instanceof TypeError, 'create(whitespace) should throw TypeError');
  assert.equal(error.message, 'ref must be a non-empty string');
}
