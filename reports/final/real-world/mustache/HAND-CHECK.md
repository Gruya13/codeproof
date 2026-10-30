# HAND-CHECK — mustache

**Repo:** https://github.com/janl/mustache.js @ `972fd2b27a036888acfcb60d6119317744fac7ee` · scope `.` (80 f./2402 LOC)
**Runovi:** `4d11c6d684b65418` ($0,4756, 2 verified), `4d11c6d684b65418-2` ($0,4067, 1 verified)
**Način provere:** čitanje koda u klonu na pinovanom commitu (`_repo/`).

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run1 F-001, run2 F-001 (isti defekt) `mustache.js:397` | `Context.lookup` koristi `cache.hasOwnProperty(name)`; keširanje imena `hasOwnProperty` obori metodu i sledeći lookup baci TypeError | **STVARAN — tvrdnja tačna** | **low-medium** | `this.cache = {'.': view}` (plain objekat). Prvi `{{hasOwnProperty}}`: `cache.hasOwnProperty("hasOwnProperty")` je `false` (nasleđena metoda nije own property keša) → `else` grana → `cache["hasOwnProperty"] = value` (linija 467). Drugi lookup istog imena: `cache.hasOwnProperty` je sada vrednost, ne funkcija → **`TypeError: cache.hasOwnProperty is not a function`**. Isto za `toString`/`valueOf`/`constructor`. **Ispravka prethodne adjudikacije:** prva ocena je pogrešno tvrdila da do upisa ne dolazi i da nema TypeError-a — upis se izvršava i TypeError je realan. Nezavisno potvrđeno i **već prijavljeno upstream**: [mustache PR #854](https://github.com/janl/mustache.js/pull/854) (open; + povezan [#856](https://github.com/janl/mustache.js/issues/856) za prototype-chain imena); ostavljen komentar sa nezavisnom potvrdom 30.10.2026. |
| run1 F-002 `mustache.js:512` | Cache ključ `template + ':' + tags.join(':')` kolizira | **STVARAN** | **low** | Logička analiza: template `"foo:bar"` + tags `["baz","qux"]` i template `"foo"` + tags `["bar:baz","qux"]` daju isti ključ `foo:bar:baz:qux`; kolizija traži custom tagove koji sadrže `:`. |

**Konačno:** 2 jedinstvena defekta, oba potvrđena; F-001 je **tačan** (TypeError pri drugom lookup-u) i **već prijavljen upstream** (PR #854) — nije nov nalaz; težina ručno **low-medium**. F-002 (kolizija keš ključa) nije prijavljen upstream. Nema izvršnog dokaza (L3 `inconclusive` — mustache je UMD nad više fajlova, repro nije stao).
