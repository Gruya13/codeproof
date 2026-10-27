# Ablation on the held-out set

Repo `/home/gru/Projects/Meta hakatron/codeproof/bench/held-out` @ `dde34bc`; 6 defects, 4 traps.

| Configuration | Published | True positives | False positives | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 + L2 | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 + L2 + L3 | 5 | 5 | 0 | 0 | 0.833 | 1 |

Measured cost: $0.2779; duration 78.2 s.

Every published finding is listed in `ablation.json` with its L1/L2/L3 outcome.
