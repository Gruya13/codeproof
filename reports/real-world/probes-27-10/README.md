# Real-world probe round — 27.10.2026 (L3 enabled)

Four repositories of different kinds were run through the full pipeline **with L3 enabled**, after the L3 hardening: a tiny utility library (defu), an async queue (p-queue), a state store (zustand) and a validation library (yup). Each target was a source directory, pinned to the repository HEAD at clone time.

| Repo | Target | Files / LOC | Proposed | Verified | L1 rejected | Reproduced | Cost |
|---|---|---:|---:|---:|---:|---:|---:|
| [unjs/defu](https://github.com/unjs/defu) `82632b6` | `src/` | 3 / 197 | 1 | 1 | 0 | 0 (inconclusive) | $0.1506 + $0.2207 |
| [sindresorhus/p-queue](https://github.com/sindresorhus/p-queue) `7f272ab` | `source/` | 5 / 1,640 | 0 | 0 | 0 | - | $0.0726 |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) `382d29c` | `src/` | 16 / 1,468 | 0 | 0 | 0 | - | $0.0564 |
| [jquense/yup](https://github.com/jquense/yup) `ff31eee` | `src/` | 33 / 4,898 | 6 | 5 | 0 | 0 (2 unavailable, 3 inconclusive) | $1.1496 |

Total measured cost: **$1.6499**; no benchmark metric (n = 4 repositories, one run each, model output is not bit-deterministic).

## Findings (hand check where done)

| Repo | Finding | Hand verdict |
|---|---|---|
| defu | F-001: `defu` is cast to `DefuInstance` which declares `fn`, `arrayFn`, `extend`, but `createDefu()` never assigns them, so the typed API is `undefined` at runtime (`types.ts:49-57` vs `defu.ts:52`) | **CONFIRMED** — type/runtime mismatch; the documented API (`defu`, `defuFn`, `defuArrayFn`) is unaffected. Severity: medium/low (scanner said higher). |
| yup | F-002: `Reference` trims the key into `this.key` but checks the untrimmed `key` for emptiness, so a whitespace-only ref passes as an empty ref instead of throwing (`Reference.ts:36-38`) | **CONFIRMED** — edge case, low/medium. |
| yup | F-004: `sortByKeyOrder` matches path segments with `includes`, so a key like `id` also matches `userId` (`util/sortByKeyOrder.ts:3-12`) | **CONFIRMED** — wrong error ordering only; low. |
| yup | F-006: `truncate()` uses `value | 0` (32-bit bitwise truncation) instead of `Math.trunc` (`number.ts:134-136`) | **CONFIRMED** — wrong result for values outside signed 32-bit range; medium. |
| yup | F-001 (shared `exclusiveTests` on `concat`), F-003 (`validateSync` vs async error value) | not hand-checked in this round — artifacts contain the citation and verifier reason. |
| p-queue, zustand | no findings proposed | scanner stayed silent on mature code; this is a recall observation, not a proof of absence. |

## What this round exposed in the system

1. **L3 cannot execute most TypeScript repositories that use extensionless imports.** defu (`from "./_utils"`) and yup (extensionless specifiers) are not directly runnable by Node without a build step; the first attempt on defu failed as `inconclusive`, then the runner was taught to report this case honestly as **`repro-unavailable`** ("the repository's own imports are not directly executable by Node without a build step"). L3 therefore works on repositories that use explicit extensions (ofetch) or plain JavaScript; for a typical TypeScript source tree it will usually be unavailable, not executed. This is now documented in the README limits.
2. **The reproducer call can hit `max_tokens`.** defu's first L3 call returned `finish_reason=length` (4,000 output tokens) and produced an empty response. The pipeline now retries once with a doubled budget (16,000) and the default is 8,000 - the same policy the scanner already had. Verified by a unit test.
3. **The reproducer sometimes guesses the wrong import root when the analyzed target is a subdirectory.** yup produced `./src/index.ts` although the target root was already `src/` (three `inconclusive` results). The prompt now states that file-list paths are relative to the analyzed root and must be imported exactly as listed.
4. **The verifier can truncate on large repositories.** On yup, one verdict came back empty with `finish_reason=length` and was correctly recorded as `uncertain` (not published as verified). For larger repositories the verifier token budget is the practical limit.

## Caveats

- All repositories are public and were cloned at their current HEAD; the model may have seen the code. Findings are not claimed as novel discoveries.
- One run per repository; scanner and verifier output is not bit-deterministic. n = 4.
- p-queue and zustand produced no findings; that is a recall observation on mature code, not evidence that the code is defect-free.
- Hand checks were done for the four findings listed above; the two remaining yup findings are published with their citations and verifier reasons but were not independently adjudicated here.

Artifacts: one directory per run under `defu/`, `p-queue/`, `zustand/`, `yup/` - `run.json`, `findings.json`, `REPORT.md`, `rejected.md`, and `repro/<id>/` for every generated reproducer.