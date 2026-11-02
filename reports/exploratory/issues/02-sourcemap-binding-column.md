Found another round-trip issue, this time in generated ranges with a binding whose expression ranges move to another line.

The encoder keeps the previous column as the base when writing the next range's column, but the decoder resets the base to 0 whenever the line changes:

```js
const range = [0, 0, 4, 10];
range.isScope = false;
range.callsite = null;
range.bindings = [[[0], [0, 2, 5], [0, 4, 9]]];

const encoded = encodeGeneratedRanges([range]);   // "AAHAEKAEIA;;;;U"
decodeGeneratedRanges(encoded)[0].bindings;
// [ [0], [0,2,5], [0,4,4] ]   expected column 9, got 4
```

Encoder (in the binding loop): `bindingStartColumn = encodeInteger(writer, expRange[2], bindingStartColumn)`. Decoder: `bindingColumn = decodeInteger(reader, bindingLine === prevBl ? bindingColumn : 0)`.

Using 0 as the column base on the encoder side whenever the line delta is non-zero would make the two agree. 1.6.0 / b760015.

Thanks!
