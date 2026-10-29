# HAND-CHECK — picomatch (regresija)

**Repo:** https://github.com/micromatch/picomatch @ `6bb40679c218cefba5d4e9662408c5fdf699a8bb` (pin iz A1 uslova 4) · scope `lib` (5 f./2445 LOC)
**Run:** `14ba4cc9f28e0092` ($0,5465, 1 verified **patch-proven**)
**Svrha:** dokaz da L3/L4 rade isto kao pre hardening-a (PREREG DoD 7) — ista meta kao u v0.2.2 sample-u.

| ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| F-001 `lib/scan.js:390-394` | `opts.tokens && prevIndex && …` — trailing token se ne dodeli kad je poslednji slash na indeksu 0 | **STVARAN — patch-proven** | **medium-low** | `prevIndex = 0` je falsy → uslov pada; `scan('/a', {tokens:true})` ostavlja trailing token bez vrednosti i podcenjuje `maxDepth`. Izvršni dokaz: reproduced 3/3 + patch-proven 3/3 (diferencni dokaz). |

**Konačno:** regresija potvrđena — L3/L4 rade na pinovanom kodu. Nema upstream prijave za ovaj defekt (nije prijavljen u ovoj rundi).
