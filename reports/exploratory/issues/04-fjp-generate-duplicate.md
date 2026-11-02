Hi — `generate()` produces duplicate root replace patches and doesn't update its mirror when the observed object's `toJSON()` changes the type (object -> array here):

```js
const { observe, generate } = require("fast-json-patch");

const obj = { a: 1, b: 2 };
const observer = observe(obj);

obj.toJSON = () => [7, 8];

generate(observer);
// [ {op:"replace", path:"", value:[7,8]}, {op:"replace", path:"", value:[7,8]} ]
// expected a single replace

generate(observer);  // same two patches again
// expected [] — the mirror was never updated
```

Two things seem to be going on. In `_generate`, the type-change branch pushes a `replace` with `path` (the parent path, not the key) once per old key, so you get one patch per property. And `generate()` ignores the return value of `applyPatch` for root replacements, so `mirror.value` stays stale; non-root replacements are applied in place, which is why this only shows up for root replaces.

A single root replace plus `mirror.value = applyPatch(...)` would fix both.

Related: #318 looks like another symptom of the same toJSON handling area.

3.1.1 (9d313ac). Thanks!
