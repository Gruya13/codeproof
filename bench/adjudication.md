# Adjudication rules (written before the first benchmark run)

These rules are fixed before the first run and published with the numbers. The adjudicator is the author of the fixture; a judge can check every decision against `expected.json` and the git history.

## Matching a published finding to an expected problem

1. A finding matches a problem when its evidence path equals the problem file and the cited line range overlaps the problem range by **at least one line**. Overlap is necessary, not sufficient.
2. The finding's claim must also identify the **cause** described in the problem's statement. A correct citation with the wrong claim is a false positive, not a true positive.
3. One expected problem yields at most **one TP**. Additional verified findings on the same problem are **duplicate equivalents**: they are not FP, but they do not add recall.
4. A finding that covers two expected problems is counted for the first one in the order of `expected.json`.
5. Citations wider than 15 lines fail L0 and never reach adjudication.

## Categories

- **TP:** verified finding matching an expected problem under the rules above.
- **FP:** verified finding that matches no problem and is not extraTrue.
- **extraTrue (X):** pre-registered real defects; counted as neither TP nor FP, but listed in the report.
- **Trap (T):** verified = bad (negative control leaked); moderate = shown separately, not part of precision; refuted = expected.
- **False refutation:** a real problem whose published status is `refuted`. Target <= 1.
- **Uncertain / L1-rejected:** reported but not counted as TP/FP.

## Runs

- **Natural end-to-end run:** scanner and verifier run normally; scanner recall, end-to-end recall and precision come from it.
- **Controlled verifier test:** candidates are injected directly into the verifier; it is recorded as `mode: controlled-verifier` and is never presented as scanner output or as benchmark recall.
- **Non-determinism:** model output is not bit-identical. The run artifacts are kept; deterministic gates (L0/L1) can be re-run over the same candidates. Metrics are not cherry-picked: if a run is repeated, the report says how many runs were made.

## Freeze

The fixture and `expected.json` are frozen after the first benchmark run. Any later change is a separate commit with a reason, and the affected numbers are labelled "pre-freeze" / not final.
