# Large historical study — 30 fix commits × 3 arms (pre-registration)

**Status:** post-freeze exploratory study on branch `experiment/post-freeze-2026-11`. Not part of the frozen
`v0.2.3-final` evidence; it does not change the audited headline numbers, the benchmark sets or the video.

**Registered:** 2026-11-01, **before the first paid call**. Sample and rules are frozen in
[MANIFEST.json](MANIFEST.json) (built by `scripts/exp-large-build-manifest.mjs` from local pinned clones).

## Sample

**30 fix commits from 6 libraries, 5 each:** `swr`, `ky`, `mustache`, `fast-json-patch`, `dateformat`,
`picomatch`. Selection rules (automated, applied before any run):

- only fix commits that touch production code (not tests/docs/build output);
- diff of 1–45 changed lines, at most 3 code files;
- scope = the directory of the most-changed file; **60–3000 LOC measured in the parent commit**;
- at most 6 tests from the same directory per repository; newest first;
- the 9 tests already used in [reports/historical/](../../historical/README.md) are **excluded**, so the sample is fresh.

The 30 tests are checkouts of the parent of each fix (the buggy state) in local pinned clones under
`reports/probes/real/candidates/historical/`.

## Protocol

Identical to `reports/historical/` and block D: check out the parent of the fix, analyze the directory of the
fixed file (`mode: smoke`), then check whether a published finding cites the same file and **overlaps the lines
the fix changes** (automated: `git diff -U0 <parent> <fix> -- <file>` → changed lines in the parent; ±3 line
tolerance). No prompt, fixture or threshold changes after the first paid call.

## Arms (90 paid runs)

| Arm | Configuration | Runs |
|---|---|---:|
| `single-6` | Spark producer + Wonder adversary, `MAX_FINDINGS=6`, L1+L2 | 30 |
| `single-12` | same, `MAX_FINDINGS=12` | 30 |
| `dual-6` | `DUAL_SCAN=1`, `MAX_FINDINGS=6`, L1+L2 | 30 |

L3/L4 are disabled in all arms (`REPRO=0 PATCH=0`) so the arms are comparable and the cost bounded: **publication
is decided by L1+L2**, and this is a recall study, not an execution-proof study. Every paid call goes through
`scripts/exp-run.sh` with its own ledger per arm (`<arm>/ATTEMPTS.jsonl`), a reservation committed to git before
the run and a settle after it; no attempt is deleted.

## Pre-registered hypotheses

- **H1 — baseline:** overall hit rate lands in the **15–30%** band (the original 2/9 = 22.2%).
- **H2 — dual lift:** `dual-6` has a higher hit rate than `single-6` (expected lift ≥ 5 percentage points).
- **H3 — candidate cap:** `single-12` has a higher hit rate than `single-6` (the 6-candidate cap limits recall).
- **H4 — scope size:** hit rate decreases with scope LOC (larger analysed scope → lower recall).

A hypothesis that fails is reported as failed, with the measured number.

## Budget and stop conditions

- Estimate: ~$25–30 for 90 runs (single ~$0.15–0.30, dual ~$0.30–0.50 per run at these scopes).
- Two ledgers (single arms and dual arm), hard cap **$40 each**; overall stop at **$45** of new spend.
- Stop early if: the first 3 tests of an arm fail for infrastructure reasons; the cost projection exceeds $45;
  anything would delay the 3.11 submission dry run or the 4.11 submission.

## What is reported and what is not claimed

- Reported: per-arm hit rate (n=30), per-repository breakdown, by-LOC-bin breakdown, per-test outcomes
  (hit/miss, published count, cost, duration), all attempts, and the four hypothesis outcomes.
- Not claimed: hand adjudication of non-hit findings (they are not counted as false positives); novelty;
  statistical significance beyond the observed sample. A miss means "the fix's lines were not cited by a
  published finding under this budget" — not "the library was clean".
- Publication: branch only unless explicitly decided otherwise.
