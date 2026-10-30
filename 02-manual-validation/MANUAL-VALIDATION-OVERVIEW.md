# Manual validation of findings — overview

> Excerpt from the final evidence package (30 Oct 2026). The original HAND-CHECK files are in [reports/final/real-world/](../reports/final/real-world/) (per repository); the raw runs are in the same tree.

This is a summary overview of the **manual adjudication** of all findings from the final round (F4, 29–30 Oct 2026).
The sources are the original `HAND-CHECK.md` files (8 of them, committed in `../reports/final/real-world/<repo>/`),
the per-run `run.json`/`findings.json`, and `../reports/final/F4-real-world.md` §4.

**Short answer to the question asked:** of the findings that passed **both gates** (L1 citation + L2 adversarial
confirmation), **21 of 21 published entries were manually checked**; **20 were confirmed as real code states**, and **1 is a
false positive** (sax F-002) — i.e. **1/21 ≈ 4.8%** false positives at the level of published entries, and the only false
positive recorded in the whole round. In addition, 2 entries are labelled **latent/dead code** (informational, not a
user-visible defect) and 1 **uncertain** finding (jsesc F-002) was manually confirmed as real but was not published as `verified`.
**No PR or issue has been accepted/merged** — see `UPSTREAM-STATUS.md`.

> Note on earlier counts: earlier drafts said "24 published entries" (16 from the new repositories + 8 from the
> regression pair, counting findings that appeared in both runs). This overview counts **entries in `findings.json`**:
> 21 `verified` entries across 13 runs + 1 `uncertain` = **22 adjudicated entries**. Both counts cover the same set of
> repositories and runs; the difference is only in what counts as an "entry" (a finding per run vs a unique defect).
> The current documents use 22 consistently.

## Method

- Every published finding was read **in the clone at the pinned commit** (not in the model's description).
- Where the run produced execution proof (`repro`/`patch`), the adjudication relies on it; where it did not, the check is static.
- Verdict per finding: **REAL / NOT A DEFECT / LATENT / UNCERTAIN**, with a hand-assigned severity (the scanner severity was not accepted automatically).
- A **re-read after independent verification (F5)** was also done: one verdict was corrected (mustache F-001), and that is
  documented rather than quietly rewritten.

## 1. Summary per repository

| Repo | Pin | Runs | Verified entries | Manual outcome | Unique defects | Upstream |
|---|---|---:|---:|---|---:|---|
| mustache | `972fd2b2` | 2 | 3 | 2 confirmed defects (F-001 correct — verdict corrected; F-002 real) | 2 | F-001 **already reported** (PR #854), F-002 **already reported in 2020** (#762, closed) |
| sax | `961ceeef` | 2 | 4 | 2 real (F-001, F-003 latent) + **1 rejected** (F-002, by design) | 2 | F-001 **new issue #303**; F-003 not reported (dead branch) |
| fast-json-patch | `9d313ac0` | 2 | 4 | 4 real (F-001, F-002/"isInteger", F-002/observe, F-004 `~~key`) | 4 | F-001 **new issue #337**; isInteger → comment on PR #331; 2 unreported |
| bcryptjs | `1211e9a2` | 2 | 4 | 3 real (F-003/base64 in both runs; F-001; F-002); 1 **patch-proven** | 3 | F-003 **already reported** (PR #170); 2 unreported |
| dateformat | `e6800aa9` | 2 | 1 | 1 real (F-001, low impact); run1 = 0 findings | 1 | F-001 **new issue #196** |
| **new repositories — total** | | **10** | **16** | **14 real entries + 1 latent + 1 rejected** | **12** | 3 duplicates + 3 new issues + 1 comment + 1 latent not reported + 4 unreported |
| picomatch (regression) | `6bb40679` | 1 | 1 | 1 real, **patch-proven** (defect re-found from v0.2.2) | 1 | not reported in this round |
| jsesc (regression) | `e3349b54` | 1 | 2 | 2 real (F-001 **patch-proven**, F-003 dead code) + 1 uncertain manually confirmed (F-002) | 2 (+1 dead code) | jsesc #79 (already reported), PR #80 partial |
| jsesc dual (regression) | `e3349b54` | 1 | 2 | 2 patch-proven entries = **1 root cause** (duplicate reported honestly) | 1 | same (jsesc #79) |
| **regression — total** | | **3** | **5 (+1 uncertain)** | **5 real** (2 root causes) | **3** | — |

**Total:** 21 verified entries + 1 uncertain = **22 manually adjudicated entries**; **1 false positive**; **2 latent/dead-code**;
**3 findings were known upstream before the round** (not presented as new discoveries).

## 2. Detailed adjudication (all findings)

| Repo | Finding (run/ID) | Citation | Claim (short) | Manual verdict | Severity | Evidence | Upstream |
|---|---|---|---|---|---|---|---|
| mustache | run1+run2 F-001 | `mustache.js:397` | `cache.hasOwnProperty(name)` — caching the name `hasOwnProperty` breaks the method and the second lookup throws `TypeError` | **REAL — correct** (first verdict wrong, corrected) | low-medium | static + independently confirmed upstream | **PR #854** (open) + comment |
| mustache | run1 F-002 | `mustache.js:512` | cache key `template + ':' + tags.join(':')` collides for tags containing a colon | **REAL** | low | static | [#762](https://github.com/janl/mustache.js/issues/762) (closed 2020) |
| sax | run1+run2 F-001 | `sax.js:1357-1371` | `SGML_DECL_QUOTED` is entered without setting `parser.q`, so a quoted SGML declaration never leaves the state | **REAL** | low-medium | static + state repro | **new issue #303** |
| sax | run2 F-002 | `sax.js:1609-1615` | valueless attribute skips xmlns handling | **NOT A DEFECT (by design)** — **false positive** | — | reading the XML spec; the verifier confirmed it | — |
| sax | run2 F-003 | `sax.js:1797-1799` | `new Error(parser, …)` in an unreachable branch | **LATENT** (dead code) | informational | static | not reported |
| fast-json-patch | run1 F-001 | `duplex.js:117-123` | `obj.toJSON` without a null check → `TypeError` for `null` | **REAL** | medium-low | repro in hand-check | **new issue #337** |
| fast-json-patch | run2 F-001 | `helpers.js:64-77` | `isInteger("")` returns true | **REAL** (root partially covered) | low-medium | static | comment on PR #331 |
| fast-json-patch | run2 F-002 | `duplex.js:46-59` | second `observe` overwrites the shared mirror baseline | **REAL** | medium-low | static | unreported |
| fast-json-patch | run2 F-004 | `core.js:214-220` | `~~key` truncation for indices > 2^31 | **REAL** | low | static | unreported |
| bcryptjs | run1 F-003 + run2 F-001 | `index.js:474-496` | `base64_decode` does not check `c4 == -1` before OR | **REAL — patch-proven in both runs** | medium | execution (reproduced+patch 3/3) | **PR #170** (open) + comment |
| bcryptjs | run1 F-001 | `index.js:172-176` | `hash()` ignores the `genSalt` error | **REAL** | medium-low | static | unreported |
| bcryptjs | run1 F-002 | `index.js:112-118` | `genSalt` throws synchronously for non-number rounds | **REAL** | low | static | unreported |
| dateformat | run2 F-001 | `src/dateformat.js:98-99` | `yyyy` does not handle negative years (`"00-1"`) | **REAL** | low / informational | repro confirmed | **new issue #196** |
| picomatch (reg.) | F-001 | `lib/scan.js:390-394` | trailing token is not set when the last slash is at index 0 | **REAL — patch-proven** | medium-low | execution 3/3 | already published in v0.2.2 (re-confirmed) |
| jsesc (reg.) | F-001 | `jsesc.js:216-225` | negative numbers in hex/bin/oct produce `0x-A` | **REAL — patch-proven** | medium | execution 3/3 | jsesc #79 (open) |
| jsesc (reg.) | F-002 | `jsesc.js:214-226` | unknown `numbers` option → `undefined` | **REAL, manually confirmed** (the system left it `uncertain`) | low | static | unreported |
| jsesc (reg.) | F-003 | `jsesc.js:203` | the second `isBigInt` branch is dead | **REAL (dead code)** | informational | static | unreported |
| jsesc dual (reg.) | F-001 + F-002 | `jsesc.js:221` / `:216-225` | negative radix literals (two claims, one root cause) | **REAL — patch-proven both** | medium | execution 3/3 | jsesc #79 |

## 3. The false positive that passed both models — sax F-002

This is the single most important data point for the question "how many false positives passed both gates".

- **Finding:** a valueless attribute in `ATTRIB_NAME_SAW_WHITE` skips `attrib()` and xmlns handling (`sax.js:1609-1615`).
- **Gates:** the L1 citation passed (the citation exists and is exact), and **the verifier confirmed it** (`confirm`) — so both **models** agreed.
- **Manual verdict:** **not a defect.** XML spec: an xmlns declaration must have a value; a valueless attribute is correctly
  treated as `strictFail('Attribute without value')` + a plain attribute with `""`. There is no namespace effect being "skipped".
- **Conclusion:** the mechanism (citation + adversarial confirmation) **is not a guarantee of truth**; this is 1 false positive
  among 21 published entries in the final round. The documentation says so ("the semantic tie is a human review, not a machine
  proof"). The verifier was wrong because it did not apply the XML rule requiring `=` for xmlns — the model lacked that domain knowledge.

## 4. The case where manual review was first wrong — mustache F-001

The original hand-check claimed that no cache write happens and that there is no `TypeError`. After independent verification
(F5, §4) the verdict was **corrected**: the first lookup of `hasOwnProperty` falls into the `else` branch (an inherited method
is not an *own* property of the cache), the value is written to the cache; the **second** lookup throws
`TypeError: cache.hasOwnProperty is not a function`. The original claim from the run is **correct**, and upstream PR #854
independently confirms it.

This is deliberately kept in the documentation: manual adjudication is not infallible, but it was corrected publicly and with
evidence (`../reports/final/F4-real-world.md` §4c, `../reports/final/F5-VERIFICATION.md` §4).

## 5. What can and cannot be claimed from this set

**Can:**
- 21 published entries, 1 false positive (4.8%), 0 unadjudicated; 1 finding is also execution-proven (bcryptjs, patch-proven in both runs).
- The verifier in F4 **rejected no finding** (0 `refuted`), so this round has no false refutations — but it also has no evidence
  that L2 rejects false positives (the only false positive passed through it). For that, see the historical cases in `../reports/final/`.
- 3 findings were known upstream before the analysis and are labelled as such; none is presented as a new discovery.

**Cannot:**
- "0 false positives" — not true; there is **1**, and it is explicitly reported.
- "accepted upstream" — no report has a maintainer response on 30 Oct 2026 (status: filed; 3 new issues open, 3 duplicates,
  1 comment on an existing PR; several independently attracted fix PRs from other people, but none was merged).
- "measured accuracy" — n is small (21 entries, 8 pins); public commits → contamination possible. This is an anecdote with evidence, not a benchmark.

## 6. Historical context (outside the final round)

So that the answer is not only F4: in earlier rounds another set of findings was manually checked (sources: `../HISTORY.md`,
`../reports/README.md`, individual `HAND-CHECK.md` files):

| Round | Manually checked | Outcome |
|---|---|---|
| v0.2.2 real-world sample (10 repositories, 23 runs) | 17 unique verified findings | **17 confirmed, 0 rejected**; 9 machine-proven |
| ofetch (real repo, 2 runs) | 4 verified | **4/4 match open upstream issues/PRs** |
| probe rounds (defu, p-queue, zustand, yup; semver, dotenv, json5, ufo, validator) | 4 + 4 hand-confirmed (of 6 + 10 published) | no confirmed false positives in what was checked |
| dogfood (CodeProof on its own `src/`) | 6 candidates → 5 verified + 1 uncertain | **5 real defects fixed + regression tests; 1 not a defect; 0 false** |
| controlled verifier test | 1 deliberately false candidate | **rejected** by a strong refutation with a machine-checked counter-citation |

**Across all rounds:** the only confirmed false positive that passed both models is **sax F-002 from F4**; there is no recorded
confirmed **false refutation** (a verifier overturning a real bug) — the closest is swr F-004, which was "partially refuted"
(see the historical `rejected.md` files in `../reports/final/real-world/` and the evidence index `../reports/README.md`).

## 7. Where the originals are

The original hand-checks are committed in the repository:

| Repo | HAND-CHECK |
|---|---|
| mustache | [`../reports/final/real-world/mustache/HAND-CHECK.md`](../reports/final/real-world/mustache/HAND-CHECK.md) |
| sax | [`../reports/final/real-world/sax/HAND-CHECK.md`](../reports/final/real-world/sax/HAND-CHECK.md) |
| fast-json-patch | [`../reports/final/real-world/fast-json-patch/HAND-CHECK.md`](../reports/final/real-world/fast-json-patch/HAND-CHECK.md) |
| bcryptjs | [`../reports/final/real-world/bcryptjs/HAND-CHECK.md`](../reports/final/real-world/bcryptjs/HAND-CHECK.md) |
| dateformat | [`../reports/final/real-world/dateformat/HAND-CHECK.md`](../reports/final/real-world/dateformat/HAND-CHECK.md) |
| picomatch (regression) | [`../reports/final/real-world/picomatch-regression/HAND-CHECK.md`](../reports/final/real-world/picomatch-regression/HAND-CHECK.md) |
| jsesc (regression) | [`../reports/final/real-world/jsesc-regression/HAND-CHECK.md`](../reports/final/real-world/jsesc-regression/HAND-CHECK.md) |
| jsesc dual (regression) | [`../reports/final/real-world/jsesc-dual-r2/HAND-CHECK.md`](../reports/final/real-world/jsesc-dual-r2/HAND-CHECK.md) |
