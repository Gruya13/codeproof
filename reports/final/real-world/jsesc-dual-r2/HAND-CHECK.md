# HAND-CHECK — jsesc-dual (dual-scan, regresija)

**Repo:** https://github.com/mathiasbynens/jsesc @ `e3349b542eaaf55239cb60519991b80097cee24b` · scope `analysis-target` (1 f./337 LOC)
**Run:** `1e1b03c5d8ba9776` ($1,4033, 1722 s, 2 verified **patch-proven**, per-scanner spark 1 / wonder 1 / both 0)
**Napomena:** prvi pokušaj (attempt 25) je pao posle 900 s — `probe-repo.mjs` spawn cap; drugi pokušaj je izmeren direktno CLI-jem kroz `final-run.sh` (bez probe omotača). Uzrok: Wonder scanner truncation (`finish_reason=length`) + retry na 32k tokena; dual run traje ~29 min.

| ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| F-001 `jsesc.js:221` | Negativni brojevi u hex/bin/oct daju nevalidne literale | **STVARAN — patch-proven** | **medium** | Isti defekt kao jsesc-regresija F-001 (i v0.2.2). Dual run ga je pronašao nezavisno; per-scanner status pokazuje spark 1 / wonder 1 — svaki model je predložio po jedan, bez preklapanja. |
| F-002 `jsesc.js:216-225` | Isti defekt opisan drugom tvrdnjom (BigInt varijanta) | **STVARAN — patch-proven (duplikat istog root cause)** | **medium** | Merge nije spojio dva nalaza jer su tvrdnje različite; hand-check ih prijavljuje kao **jedan root cause** (negativni radix literali), ne kao dva defekta. |

**Konačno:** dual-scan regresija potvrđena; 1 root cause, 2 published unosa (duplikat prijavljen pošteno). Prvi (neuspeli) pokušaj $4 rezervacije ostaje u manifestu kao `unknown-cost` — stvarni trošak $0 do prekida; prijavljeno.
