# HAND-CHECK — jsesc (regresija)

**Repo:** https://github.com/mathiasbynens/jsesc @ `e3349b542eaaf55239cb60519991b80097cee24b` (lokalni klon iz A1/A2; `analysis-target/jsesc.js` sha256 `03c367cb…`) · scope `analysis-target` (1 f./337 LOC)
**Run:** `ea5b1ae7f3eeac48` ($0,6289, 2 verified — 1 patch-proven, 1 verified, 1 uncertain)
**Svrha:** regresija L3/L4 na istoj meti kao v0.2.2.

| ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| F-001 `jsesc.js:216-225` | Negativni brojevi u hex/bin/oct daju `0x-A` umesto `-0xA` | **STVARAN — patch-proven** | **medium** | `result = '0x' + argument.toString(16)`; `(-255).toString(16) = "-ff"` → `"0x-ff"` — nevalidan JS literal. Izvršni dokaz (reproduced + patch-proven). Isti defekt kao u v0.2.2 (upstream issue #79). |
| F-002 `jsesc.js:214-226` | Nepoznata `numbers` opcija vraća `undefined` | **STVARAN (ručno potvrđen; sistem ga je ostavio `uncertain`)** | **low** | Ako `options.numbers` nije dec/hex/bin/oct, `result` ostaje `undefined`, funkcija vraća `undefined` (ili `"undefinedn"` za BigInt) umesto greške/stringa. Nedostaje validacija ulazne opcije. Nije published kao verified — ostaje u rejected/uncertain trag-u. |
| F-003 `jsesc.js:203` | Drugi `isBigInt` branch je mrtav | **STVARAN (mrtav kod)** | **informational** | `if (isNumber(argument) || isBigInt(argument)) { … } else if (isBigInt(argument)) { … }` — druga grana se nikad ne izvrši. Ne menja ponašanje. |

**Konačno:** regresija potvrđena (patch-proven L4 radi); 2 stvarna + 1 mrtav kod + 1 uncertain ručno potvrđen. Upstream status: jsesc #79 (open), PR #80 delimičan fix.
