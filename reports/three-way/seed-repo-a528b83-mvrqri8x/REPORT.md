# Three-way comparison — same task, three architectures

Task: seed-repo @ a528b83 — 15 files / 229 LOC; ground truth: 8 problems, 4 traps, 2 extraTrue.

| Variant | Candidates | Problems hit (scanner recall) | Verified recall | Precision | Unmatched claims | Claims on traps | Cost | Duration |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| spark-alone (`muse-spark-1.3`) | 9 | 8/8 (100%) | n/a — no verification | 100% | 0 | 0 | $0.0255 | 15 s |
| wonder-alone (`muse-wonder-1.0`) | 8 | 7/8 (87.5%) | n/a — no verification | 100% | 0 | 0 | $0.1346 | 52 s |
| codeproof (`spark + wonder + L3`) | 10 | 7/8 (87.5%) | **6/8** | **85.7%** (verified-only) | 1 FP | 0/4 verified | $0.7037 | 282 s |

Caveat: the standalone models only *propose*; none of their candidates is verified, so their recall is scanner recall and their "precision" is a position-level estimate, not a verified metric. CodeProof's recall/precision are verified-only, computed from findings.json status by the frozen benchmark scorer.
