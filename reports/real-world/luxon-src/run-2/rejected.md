# Rejected and unresolved findings

Commit: f427515a38f6a671f8de663e6bcc040ed81f114e  |  run-id: 05c5c12c8485a80c

This file exists on purpose: the product is not 'we found everything', it is 'we do not publish what we could not prove'. Rejected findings stay visible with the evidence that refuted them.

## Refuted

### F-002 - startOf locale weeks uses ISO weekday/weekNumber

**Claim:** startOf('weeks',{useLocaleWeeks:true}) reads ISO weekday/weekNumber but compares/assigns against locale startOfWeek, so locale weeks starting on non-Monday compute the wrong week start.

**Verifier (muse-wonder-1.0):** refute/strong - impl/conversions.js:47-58 shows startOfWeek is applied directly as an offset to the ISO weekday returned by dayOfWeek, so getStartOfWeek uses ISO numbering (Mon=1..Sun=7) rather than a locale-relative numbering; therefore comparing and assigning ISO weekday/weekNumber against it at datetime.js:1779-1782 is consistent and finds the most recent locale-start weekday.

**Counter-citation:** impl/conversions.js:47-48 (machine-checked)
```text
export function isoWeekdayToLocal(isoWeekday, startOfWeek) {
  return ((isoWeekday - startOfWeek + 7) % 7) + 1;
```
**Counter-citation:** impl/conversions.js:55-58 (machine-checked)
```text
export function gregorianToWeek(gregObj, minDaysInFirstWeek = 4, startOfWeek = 1) {
  const { year, month, day } = gregObj,
    ordinal = computeOrdinal(year, month, day),
    weekday = isoWeekdayToLocal(dayOfWeek(year, month, day), startOfWeek);
```

## Uncertain

_None this run._
