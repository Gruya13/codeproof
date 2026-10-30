# HAND-CHECK — dateformat

**Repo:** https://github.com/felixge/node-dateformat @ `e6800aa902fcbd523d5ea06a9a79050878cfa48e` · scope `.` (43 f./2085 LOC)
**Runs:** `fead8f9fa0544305` ($0.0717, **0 findings**), `fead8f9fa0544305-2` ($0.1945, 1 verified)
**Method:** reading the code in the clone at the pinned commit.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| run2 F-001 `src/dateformat.js:98-99` | `yyyy` does not handle negative years | **REAL — new, reported upstream** | **low / informational** | `yy: () => pad(Math.abs(y()), 2).slice(-2)` uses `Math.abs`, but `yyyy: () => pad(y(), 4)` does not: `String(-1).padStart(4,'0') = "00-1"` (minus in the middle). Affects historical dates (before year 1); normal dates are not affected. Confirmed repro: `dateFormat(new Date(-1,0,1), "yyyy")` → `"00-1"`. **Reported 30 Oct 2026:** [issue #196](https://github.com/felixge/node-dateformat/issues/196). |

**Final:** 1 real defect, low impact; **reported upstream on 30 Oct 2026** ([issue #196](https://github.com/felixge/node-dateformat/issues/196)). The **0-finding run is reported as such** (run1 0 proposed — the model found nothing, it is not hidden).
