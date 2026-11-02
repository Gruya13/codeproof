Hi — the document-dependent validation in `validator()` is behind `else if (document)`, so a falsy document skips all of it and the next thing you see is a raw TypeError:

```js
applyPatch(0, [{ op: "add", path: "/a", value: 1 }], true);
// TypeError: Cannot create property 'a' on number '0'
// expected JsonPatchError / OPERATION_PATH_CANNOT_ADD
```

`0`, `false`, `""` and `null` are all valid JSON documents, so the guard should check for undefined/null rather than truthiness. 3.1.1 (9d313ac).

Thanks!
