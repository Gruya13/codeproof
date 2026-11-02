Hi — I've been poking at the scopes helpers and ran into a round-trip problem when there's more than one top-level original scope.

With a single root scope everything is fine. With two roots, the second one comes back shifted by the end line of the first:

```js
const scope = (t) => { const s = t.slice(); s.vars = []; return s; };
const scopes = [scope([0, 0, 5, 10, 1]), scope([6, 0, 10, 10, 1])];

encodeOriginalScopes(scopes);   // "AACA,KU,MACA,IU"
decodeOriginalScopes("AACA,KU,MACA,IU");
// [ [0,0,5,10,1], [11,0,15,10,1] ]   expected [6,0,10,10,1]
```

The encoder starts every top-level scope with a fresh `[0]` state (`i = _encodeOriginalScopes(scopes, i, writer, [0])`), while the decoder keeps one running `line` for the whole input (`let line = 0` outside the loop). So the second root's deltas are relative to 0 on the way in and relative to the previous scope on the way out.

I'm not sure whether the format is meant to support multiple roots, but if it is, one of the two sides needs to change — either keep a single encoder state for the whole list, or reset the decoder's line per root. If only one root is allowed, encoding should probably reject the input rather than produce a string that doesn't decode back.

Reproduced on sourcemap-codec 1.6.0 (monorepo main, b760015). The existing tests only use a single root, which is likely why this slipped through.

Thanks!
