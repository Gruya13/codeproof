# HAND-CHECK — fast-json-patch

**Repo:** https://github.com/Starcounter-Jack/JSON-Patch @ `9d313ac01916e525e9204074f06e5295edec491b` · scope `commonjs` (3 f./803 LOC)
**Runovi:** `4e12c16371305216` ($0,2514, 1 verified), `4e12c16371305216-2` ($0,4997, 3 verified)
**Način provere:** čitanje koda u klonu na pinovanom commitu.

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run1 F-001 `duplex.js:117-123` | `_generate` dereferencira `obj.toJSON` bez null provere | **STVARAN** | **medium-low** | `if (obj === mirror) return;` pa `typeof obj.toJSON === "function"` — kada je `obj` `null` (JSON null dokument/vrednost), `typeof null.toJSON` baca TypeError umesto da generiše `replace` patch. |
| run2 F-001 `helpers.js:64-77` | `isInteger("")` vraća true | **STVARAN** | **low-medium** | `len=0` → `while` se ne izvrši → `return true`; u `core.js:218` `~~""` = 0, pa prazan array ključ postaje indeks 0 umesto nevalidnog. |
| run2 F-002 `duplex.js:46-59` | Drugi `observe` prepisuje shared mirror baseline | **STVARAN** | **medium-low** | `mirror.value = _deepClone(obj)` se radi na svakom novom observer-u istog objekta; postojeći observer-i koji nisu generisali promene gube baseline. |
| run2 F-004 `core.js:214-220` | `~~key` truncation za velike indekse | **STVARAN** | **low** | `~~` konvertuje u 32-bit signed int; indeksi > 2^31 wrap-uju i adresiraju pogrešan element/prolaze bounds check. |

**Konačno:** 4 stvarna defekta, svi potvrđeni statički; nijedan nema izvršni dokaz (L3 `inconclusive` — generisani repro nije prošao L0).
