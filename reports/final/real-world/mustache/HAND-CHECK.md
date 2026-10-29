# HAND-CHECK — mustache

**Repo:** https://github.com/janl/mustache.js @ `972fd2b27a036888acfcb60d6119317744fac7ee` · scope `.` (80 f./2402 LOC)
**Runovi:** `4d11c6d684b65418` ($0,4756, 2 verified), `4d11c6d684b65418-2` ($0,4067, 1 verified)
**Način provere:** čitanje koda u klonu na pinovanom commitu (`_repo/`).

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run1 F-001, run2 F-001 (isti defekt) `mustache.js:397` | `Context.lookup` koristi `cache.hasOwnProperty(name)`; tvrdi da keširanje imena `hasOwnProperty` obori metodu i baci TypeError | **STVARAN defekt, ali mehanizam u tvrdnji je netačan** | **low** | `this.cache = {'.': view}` (plain objekat) + `cache.hasOwnProperty(name)`. Za `name="hasOwnProperty"` nasleđena metoda vrati `true`, pa `value = cache[name]` vraća **nasleđenu funkciju**, a upis `cache[name]=value` (linija 467) se **nikad ne izvrši** za to ime → nema TypeError-a. Efekat: rezervisana imena (`hasOwnProperty`, `toString`, `valueOf`, `constructor`) ne resolvuju se iz view-a nego vraćaju nasleđenu funkciju (koja se pozove sa view kao `this`). |
| run1 F-002 `mustache.js:512` | Cache ključ `template + ':' + tags.join(':')` kolizira | **STVARAN** | **low** | Logička analiza: template `"foo:bar"` + tags `["baz","qux"]` i template `"foo"` + tags `["bar:baz","qux"]` daju isti ključ `foo:bar:baz:qux`; kolizija traži custom tagove koji sadrže `:`. |

**Konačno:** 2 jedinstvena defekta, oba potvrđena; F-001 potvrđen ali sa ispravljenim mehanizmom (nema TypeError-a — to je pogrešan opis, ne lažan nalaz) i težinom **low**, ne medium/high. Nema izvršnog dokaza (L3 `inconclusive` — mustache je UMD nad više fajlova, repro nije stao).
