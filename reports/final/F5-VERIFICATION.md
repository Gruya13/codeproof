# F5 — independent verification (final round)

**Date:** 2026-10-30 (02:30–03:00 CET) · **Verified revision:** `ebcbe4a` (F5 commits)
**Cost:** $0 (the Meta API was not used; the verifiers are other models, not the Meta Model API)

## 1. agy-verify — blind input (spec + artifacts + claims, without the executor's reasoning)

**Finding: all 9 claims CONFIRMED, 0 factual counterexamples.**

Checked (statically, from the artifacts): tag `v0.2.3-final` → `490e302`, `srcTreeSha` `f874d642`; git history
after the tag does not touch `src/`; test-lock sidecars and authorship signatures (3 new test files); integrity 22 checks;
calibration 7/8 + 7/8 + 8/8 (precision 1, 0/4 traps, 0 FR, `mock:false`); extended 3/16 and 9/16 (0/5);
held-out 6/6 through L2 and 5/6 through L3 (0 traps); real-world published entries (16 new + regression = 24),
bcryptjs 1 unique defect patch-proven in both runs, 8 HAND-CHECK files, sax F-002 marked as rejected; cost from `ATTEMPTS.jsonl`
= **$15.7162595** (rounded $15.7163), attempts 1..26 without gaps, 3 unknown-cost reservations = $10;
picomatch/jsesc pins the same as in the v0.2.2 sample and the documentation declares them as **re-confirmed, not new**.

**Limitation (reported):** agy ran in `safe` mode and **could not execute a single shell command** —
the pre-tool hook `/home/gru/.gemini/config/scripts/sandbox_guard.py` rejects `run_command` in headless mode
(no `/dev/tty`). That is why the verification is **static** (reading artifacts, hashes, git logs, JSONs) and not
execution-based; agy reported this itself in the finding. The live run of `make test`/`integrity`/`replay`/`audit` was done by the
orchestrator in [F5-baseline.md](F5-baseline.md).

## 2. codex-verify — test integrity WATCHDOG

**Finding: WATCHDOG OK.**

```
WATCHDOG OK   tests/*.test.mjs 39/39 locked, sha256 31cc66caec8a2894f63a6b4002193cfabfda59cca49f451a269ed375c37573c9,
              git HEAD ebcbe4ae92d546d39f502442ca54b78587ff1ec0,
              authors codex/orchestrator/dsh-orkestrator
```

Evidence (independently executed in the codex verify worktree):
- `node scripts/test-lock.mjs check tests/*.test.mjs` → **39/39 LOCKED**, exit 0;
- for all 39: `git show <lock.gitRevision>:<lock.gitRel>` sha256 = `lock.casesSha256` = hash of the current file;
- all 39 lock sidecars are **in git**; all **17 relock** entries have `by` and `reason`;
- `node scripts/integrity.mjs` → **INTEGRITY PASS: 22 checks**;
- authorship signatures: `dcf1c8a` (F0 tests, author: codex), `0cc0849` (F1 tests, author: codex);
- static test count: **268 = 241 baseline + 22 F0 + 5 F1**.

**Limitation (reported):** codex did not execute the full test set (watchdog mode does not spawn subprocesses), so
"268/268 passes" from its thread **is not confirmed by execution**. The execution part was done independently in
[F5-baseline.md](F5-baseline.md): 268/268 on Node 26 and Node 22, integrity/replay/score/clean-clone PASS.

## 3. Conclusion (DoD 8)

| Requirement | Result |
|---|---|
| agy-verify blindly confirmed all final numbers | ✅ 9/9 confirmed, 0 counterexamples (static; limitation reported) |
| codex-verify WATCHDOG OK (hash + git revision) | ✅ 39/39, sha256 `31cc66ca…`, HEAD `ebcbe4a`, integrity PASS |
| no model verifies its own work | ✅ agy and codex wrote neither the code nor the tests of the final round (code: DSH, tests: codex in the work thread; verification: agy + codex verify thread) |
| independent **execution** verification of the test set | ⚠️ not done by the verifiers (sandbox); performed by the orchestrator in F5-baseline — reported, not hidden |

**No counterexample was found.** The verifiers did not change a single file.

## 4. Post-verification update (30.10.2026)

An independent check of the upstream trackers after the verification showed that **3 of 12** F4 findings had already been
reported before our analysis (mustache PR #854; mustache #762, closed in 2021; bcryptjs PR #170) and that **1 finding in the hand-check had been assessed
incorrectly** (mustache F-001 — the TypeError is real). The documentation was corrected in
[F4-real-world.md](F4-real-world.md) §4b/§4c, [README.md](README.md) §4d, the hand-checks and the public README;
**3 new issues were opened** (fast-json-patch #337, dateformat #196, sax #303), 1 comment was left on an
existing PR (#331) and comments on the two known reports. Claim no. 9 from the agy finding (re-confirmed status) is thereby supplemented — see §4b.
