# luxon probe runs - hand check

- Repository: [moment/luxon](https://github.com/moment/luxon) at commit `f427515a38f6a671f8de663e6bcc040ed81f114e` (2026-08-09, `luxon@3.7.2`)
- Scope: `src/` - 24 files, 8,582 LOC; all 24/24 files fit the scanner prompt (332,249 chars, ~92k tokens)
- Runs: 2 runs on the same commit, mode `smoke`, scanner `muse-spark-1.3`, verifier `muse-wonder-1.0`, `MAX_FINDINGS=8`
- Measured: run 1 **1 proposed / 1 verified** ($0.4245, 144 s); run 2 **2 proposed / 1 verified / 1 refuted** ($0.6781, 324 s). Total **$1.1026**.
- Method: static analysis + public-API probes on a copy of the repo in `/tmp` (no repository code was executed as part of the analysis; the probe calls only the library's public API to check observable behavior).

## F-001 (verified in both runs) - `uncomputeOrdinal` returns January for every ordinal

**Claim:** `uncomputeOrdinal` uses `findIndex(i => i < ordinal)` on the month ladders, so for any ordinal >= 1 the first ladder entry (0) matches, the month is always January, and the day becomes `ordinal`.

**Code:** `src/impl/conversions.js:40-45`

```js
function uncomputeOrdinal(year, ordinal) {
  const table = isLeapYear(year) ? leapLadder : nonLeapLadder,
    month0 = table.findIndex((i) => i < ordinal),
    day = ordinal - table[month0];
  return { month: month0 + 1, day };
}
```

**Hand verdict: confirmed at the function-contract level, but the user-visible "critical" claim is not demonstrated.** The internal conversion is indeed wrong (should be `findLastIndex(i => i < ordinal)`, or equivalent); direct calls return `{month: 1, day: ordinal}` (e.g. 200 -> January 200, and `weekToGregorian(2023-W20-3)` -> `{year: 2023, month: 1, day: 137}`).

However, every public API we probed produced correct calendar dates because the wrong month/day is normalized by JavaScript `Date` overflow and by `DateTime`'s timestamp/calendar normalization:

- 731 ordinal cases (`DateTime.fromObject({year, ordinal})` for all 365/366 days of 2023/2024): **0 mismatches** vs `Date.UTC`.
- 468 ISO-week cases (`fromObject({weekYear, weekNumber, weekday})` for 2022-2024 x weeks 1-52 x weekdays 1/3/7): **0 mismatches** vs an independent ISO-week reference.
- `set({ordinal})`, `set({weekYear, weekNumber, weekday})`, `fromISO('2023-200')`, `fromISO('2023-W20-3')`: all correct month/day/weekday values.

So this is a **latent internal invariant bug** (a future caller using `ordinalToGregorian`/`weekToGregorian` directly before normalization would see wrong month/day), not a demonstrated user-visible defect. Hand severity: **low / informational**; the scanner rated it critical. No matching upstream issue was found (searches: "uncomputeOrdinal" 0 results, "ordinal" issues open are unrelated).

Suggested upstream fix: `table.findLastIndex((i) => i < ordinal)` (this inverts `computeOrdinal` correctly for every ordinal 1..366).

Verification limit: we did not run luxon's own test suite; the conclusion rests on the code reading plus the public-API probe above.

## F-002 (refuted in run 2) - organic refutation with machine-checked counter-citation

**Claim (scanner):** `startOf('weeks', {useLocaleWeeks: true})` reads ISO weekday/weekNumber but compares/assigns against locale `startOfWeek`, so locale weeks starting on non-Monday are computed wrongly.

**Verifier:** `refute/strong` with two counter-citations:
- `impl/conversions.js:47-48`: `isoWeekdayToLocal(isoWeekday, startOfWeek)` converts the ISO weekday to locale-relative numbering.
- `impl/conversions.js:55-58`: `gregorianToWeek` applies that conversion with the locale `startOfWeek` before computing `weekday`/`weekNumber`.
- `counterEvidenceL1.passed = true`, `counterEvidencePolicy = {inContext: true, distinctFromCitation: true}`.

**Hand verdict: the refutation is correct; the claim is false.** Public-API probes:
- `en-US` (week starts Sunday): `2023-05-17` -> start of locale week `2023-05-14`; `2023-05-21` -> `2023-05-21`.
- `de-DE` (week starts Monday): `2023-05-17` -> `2023-05-15`; `2023-05-21` -> `2023-05-15`.

`this.weekday` and `this.weekNumber` are already locale-relative (as the counter-citations show), so comparing them with `getStartOfWeek()` is consistent. This is a good example of the L2 gate rejecting a plausible-looking but wrong claim with a machine-checked counter-citation.

## Runs / evidence

- `run-1/`, `run-2/`: verbatim run artifacts (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, `candidates.json`)
- `probe.json`, `scope.json`: harness outputs
- Both runs are published; the refuted finding stays in `run-2/rejected.md`.

## Caveats

- Public commit; contamination is possible. Qualitative anecdote, not a benchmark metric.
- The verified finding is latent/internal with no demonstrated user-visible effect; the scanner's severity (critical) is not supported by the hand check.
- No recall/completeness claim: run 1 and run 2 differ in findings.
