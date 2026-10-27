# Ablation on the held-out set

Repo `/home/gru/Projects/Meta hakatron/codeproof/bench/held-out` @ `0ec22e5`; 6 defects, 4 traps.

| Configuration | Published | True positives | False positives | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 | 0 | 0 | 0 | 0 | 0 | n/a |
| + L1 + L2 | 0 | 0 | 0 | 0 | 0 | n/a |
| + L1 + L2 + L3 | 0 | 0 | 0 | 0 | 0 | n/a |

Measured cost: $0.0148; duration 14.8 s.

Every published finding is listed in `ablation.json` with its L1/L2/L3 outcome.
