# Three-way comparison — same task, three architectures

Task: seed-repo @ a528b83 — 15 files / 229 LOC; ground truth: 8 problems, 4 traps, 2 extraTrue.

| Variant | Candidates | Problems hit (scanner recall) | Verified recall | Precision | Unmatched claims | Claims on traps | Cost | Duration |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| spark-alone (`muse-spark-1.3`) | n/a | n/a/8 (n/a) | n/a — no verification | n/a | n/a | n/a | $n/a | n/a |
| wonder-alone (`muse-wonder-1.0`) | n/a | n/a/8 (n/a) | n/a — no verification | n/a | n/a | n/a | $n/a | n/a |
| codeproof (`spark + wonder + L3`) | 18 | 8/8 (100%) | **8/8** | **100%** (verified-only) | 0 FP | 0/4 verified | $0.7605 | 266 s |

Caveat: the standalone models only *propose*; none of their candidates is verified, so their recall is scanner recall and their "precision" is a position-level estimate, not a verified metric. CodeProof's recall/precision are verified-only, computed from findings.json status by the frozen benchmark scorer.
