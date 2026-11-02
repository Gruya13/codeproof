# Large historical study — results

**Protocol:** pre-registered in [PRE-REGISTRATION.md](PRE-REGISTRATION.md), sample frozen in
[MANIFEST.json](MANIFEST.json) before the first paid run. Every run through `scripts/exp-run.sh` with a
per-arm ledger; hit check automatic (fix diff → changed lines in the parent → published finding overlaps a
changed line, ±3). **Total: 72 paid runs, $31.6061.**

| Arm | Runs | Hits | Hit rate | Cost | Cost per hit | Failed attempts |
|---|---:|---:|---:|---:|---:|---:|
| `single-6` (MAX_FINDINGS=6) | 30/30 | **6** | **20.0%** | $8.0796 | $1.35 | 0 |
| `single-12` (MAX_FINDINGS=12) | 29/30 | **6** | **20.7%** | $9.1654 | $1.53 | 1 |
| `dual-6` (DUAL_SCAN=1) | 13/30 *(stopped)* | **2** | **15.4%** | $14.3611 | $7.18 | 2 |

`single-12` is missing `picomatch-5f5819dd` (one run aborted on the per-run budget gate; recorded as failed in
the ledger). `dual-6` was **stopped at n=13**: the Wonder scanner repeatedly returned empty output on these
scopes (finish_reason=length), so most dual runs fell back to Spark-only and each run took 5–8 minutes
(scan alone 400–440 s on mustache). Continuing would have cost roughly all of the remaining credit for a
configuration that was not running as designed; the partial result is reported as measured.

## Hits by repository (single-6, n=30)

| Repository | Hits |
|---|---|
| dateformat | **3/5 (60%)** |
| fast-json-patch | **2/5 (40%)** |
| mustache | 1/5 (20%) |
| swr | 0/5 |
| ky | 0/5 |
| picomatch | 0/5 |

The sample is not homogeneous: the same gate finds 60% of the fix commits in one library and none in three
others. That is a stronger statement than a single global number, and it is why the repository-level
breakdown is published next to it.

## Pre-registered hypotheses

| # | Hypothesis | Outcome | Measured |
|---|---|---|---|
| **H1** | Overall hit rate in the 15–30% band | **CONFIRMED** | **20.0%** (6/30); the original 2/9 was 22.2% |
| **H2** | `dual-6` beats `single-6` by ≥5 pp | **CONFIRMED ON THE PAIRED SUBSET (n=13)**, not conclusive | paired: **single 0/13, dual 2/13 = +15.4 pp**; the dual arm's Wonder fallback means the comparison is weaker than designed |
| **H3** | `single-12` beats `single-6` (candidate cap limits recall) | **REFUTED** | **20.7% vs 20.0%** (Δ +0.7 pp) at +13.4% cost — the 6-candidate cap is not the recall limit |
| **H4** | Hit rate decreases with scope LOC | **CONFIRMED (small bins)** | 0–500 LOC: **3/6 (50%)**; 500–1000: **2/15 (13.3%)**; >1500: **1/9 (11.1%)** (no tests in 1000–1500) |

## What the study adds

1. **The weakest published number is real and not a 9-sample accident.** 2/9 (22.2%) reproduced as 6/30 (20.0%)
   on 30 different fix commits from 6 libraries.
2. **Recall is dominated by analysis scope size, not by candidate count.** ≤500 LOC scopes: 50%; >500 LOC: ~12%.
   Raising the candidate cap from 6 to 12 changed nothing but the bill. The actionable lever is analysing smaller
   units (the chunking result from F3, now reproduced on organic defects).
3. **Dual scanning is a recall/price trade-off.** On the 13 paired tests where both arms ran, single found 0 and
   dual found 2 — but dual cost $7.18 per hit vs $1.35, and the Wonder scanner does not reliably emit valid JSON
   at these scope sizes, so the dual configuration cannot be trusted as-is.
4. **Library-level variance is huge** (60% vs 0%), which cautions against a single headline recall number.

## Limitations

- n = 30 (single) and n = 13 (dual); confidence intervals are wide. The per-repository numbers are 5-test anecdotes.
- Non-hit findings were not hand-adjudicated; a miss means "the fix's lines were not cited by a published
  finding under this budget", not "the library was clean".
- Public fix commits predate the analysis, so contamination is possible (same caveat as the original historical
  test).
- One single-12 run and two dual-6 runs failed (budget gate); they are in the ledgers and are not hidden.
- The hit check counts a finding that overlaps the fixed lines; it does not judge whether the stated claim is
  the same root cause (that was done by hand only in the original 9-test suite and in block C).

## Cost

| Part | Cost |
|---|---:|
| `single-6` | $8.0796 |
| `single-12` | $9.1654 |
| `dual-6` | $14.3611 |
| **Total** | **$31.6061** |
