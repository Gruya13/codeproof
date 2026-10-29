# HAND-CHECK — bcryptjs

**Repo:** https://github.com/dcodeIO/bcrypt.js @ `1211e9a2213e0b3ee232a204b3ce899beebce31a` · scope `.` (11 f./1666 LOC)
**Runovi:** `56f8831fa1284062` ($0,9219, 3 verified — 1 patch-proven), `56f8831fa1284062-2` ($0,3876, 1 verified patch-proven)
**Način provere:** čitanje koda; patch-proven nalazi imaju generisani test + patch iz runa.

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run1 F-003 + run2 F-001 (isti defekt) `index.js:474-496` | `base64_decode` ne proverava `c4 == -1` pre OR | **STVARAN — patch-proven** | **medium** | `c1/c2/c3` imaju `== -1 → break`; `c4` nema: `o |= c4` sa -1 daje 0xFFFFFFFF, `String.fromCharCode` = 65535, `olen++`. Izvršni dokaz: reproduced 3/3 + patch-proven 3/3 (oba runa). |
| run1 F-001 `index.js:172-176` | `hash()` ignoriše `genSalt` grešku | **STVARAN** | **medium-low** | Numerički salt: `genSalt(salt, function (err, salt) { _hash(password, salt, …) })` bez `if (err)`. `genSaltSync` baca za rounds van 4–31 (`index.js:948-949`), pa `_hash` dobija `undefined` salt i baca drugu grešku — maskira original. |
| run1 F-002 `index.js:112-118` | `genSalt` baca sinhrono za ne-number rounds i kad je callback prisutan | **STVARAN** | **low** | `else if (typeof rounds !== "number") throw Error(...)` pre callback-a; `hash/compare` argument-greške daju kroz callback — nedosledno ponašanje. |

**Konačno:** 3 stvarna defekta potvrđena; 1 sa **patch-proven** (i time execution-proven) izvršnim dokazom — **ispunjava DoD 7 „≥1 execution-proven / patch-proven na novim repoima“**.
