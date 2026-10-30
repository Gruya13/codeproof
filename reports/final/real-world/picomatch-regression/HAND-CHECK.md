# HAND-CHECK — picomatch (regression)

**Repo:** https://github.com/micromatch/picomatch @ `6bb40679c218cefba5d4e9662408c5fdf699a8bb` (pin from A1 condition 4) · scope `lib` (5 f./2445 LOC)
**Run:** `14ba4cc9f28e0092` ($0.5465, 1 verified **patch-proven**)
**Purpose:** proof that L3/L4 work as before the hardening (PREREG DoD 7) — same target as in the v0.2.2 sample.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| F-001 `lib/scan.js:390-394` | `opts.tokens && prevIndex && …` — the trailing token is not assigned when the last slash is at index 0 | **REAL — patch-proven** | **medium-low** | `prevIndex = 0` is falsy → the condition fails; `scan('/a', {tokens:true})` leaves the trailing token without a value and underestimates `maxDepth`. Execution proof: reproduced 3/3 + patch-proven 3/3 (differential proof). |

**Final:** regression confirmed — L3/L4 work on the pinned code. No upstream report for this defect (not reported in this round).
