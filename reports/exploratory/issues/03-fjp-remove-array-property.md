Hi — found this while testing patch application on arrays that carry extra properties.

`arrOps.add` handles non-integer keys (`arr[i] = value`), but `arrOps.remove` always calls `splice`, so removing a property from an array quietly removes the element at index 0 instead and leaves the property in place:

```js
const doc = { arr: [1, 2, 3] };
doc.arr.foo = "bar";

applyOperation(doc, { op: "remove", path: "/arr/foo" }, false);

doc.arr;      // [2, 3]   expected [1, 2, 3]
doc.arr.foo;  // "bar"    expected undefined
```

Not sure a non-index token on an array is even a valid pointer per RFC 6901, but since `add` supports it, `remove` probably should too — or it should throw a JsonPatchError instead of silently removing a different element.

Seen on 3.1.1 (9d313ac), `src/core.ts`.

Thanks!
