# Rejected and unresolved findings

Commit: 89f18b2880afbca9fc26a0f926e862d549036349  |  run-id: 65857ce15ea9d5c3

> **CONTROLLED VERIFIER TEST** - candidates were injected directly into the verifier; they are not scanner output.

This file exists on purpose: the product is not 'we found everything', it is 'we do not publish what we could not prove'. Rejected findings stay visible with the evidence that refuted them.

## Refuted

### F-101 - Catch block swallows batch errors

**Claim:** The catch block in runAll swallows the failure: it logs the error but never rethrows, so callers continue as if the batch had succeeded.

**Verifier (muse-wonder-1.0):** refute/strong - The catch block rethrows the error at src/batch.js:6, so it does not swallow the failure.

**Counter-citation:** src/batch.js:6-6 (machine-checked)
```text
    throw error;
```

## Uncertain

_None this run._
