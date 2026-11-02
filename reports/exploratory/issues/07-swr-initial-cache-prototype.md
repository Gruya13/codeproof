Same function as my other report, one more issue: the server-snapshot getter does `if (key in INITIAL_CACHE) return INITIAL_CACHE[key]`.

`INITIAL_CACHE` is a plain `{}`, so for a key like `"toString"` the `in` check matches an inherited property and the snapshot returns `Object.prototype.toString` instead of the cache value:

```js
const [, , , snap] = createCacheHelper(new Map(), "toString");
snap(); // [Function: toString]
// expected {}
```

Any key that happens to match an Object.prototype member (`toString`, `constructor`, `valueOf`, `__proto__`...) hits this. `Object.create(null)` for the cache and/or `Object.hasOwn()` for the check would fix it.

2.3.x (8148ef01). Thanks!
