#!/usr/bin/env bash
# Final-round run wrapper (PREREG-AMENDMENT-3 §3): reserve -> git anchor -> run -> settle -> commit.
#
# Every paid run of the final round goes through this wrapper, one attempt at a time. The
# reservation is committed to git BEFORE the run starts, so deleting the last manifest row cannot
# erase the trace; the settle after the run records the measured cost (or keeps the reservation as
# unknown-cost when the run crashed or the cost is not measurable).
#
# Usage:
#   scripts/final-run.sh --attempt <n> --block <block> --label <label> --max <usd> --out <dir> \
#       [--ledger <path>] [--no-git] -- <command...>
#
# Example (F1 dogfood chunked):
#   BUDGET_USD=4 CHUNKED_SCAN=1 scripts/final-run.sh --attempt 1 --block F1 \
#     --label dogfood-chunked --max 6 --out reports/final/self-analysis/chunked -- \
#     node src/cli.mjs analyze src --mode smoke --out reports/final/self-analysis/chunked --allow-output-in-target
#
# --no-git is for $0 dry runs only (mock runs in /tmp); a real attempt must be anchored in git.
set -euo pipefail

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

ATTEMPT=""; BLOCK=""; LABEL=""; MAX=""; OUT=""; LEDGER="reports/final/ATTEMPTS.jsonl"; GIT=1
while [ $# -gt 0 ]; do
  case "$1" in
    --attempt) ATTEMPT="$2"; shift 2 ;;
    --block) BLOCK="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --max) MAX="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --ledger) LEDGER="$2"; shift 2 ;;
    --no-git) GIT=0; shift ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done
[ $# -gt 0 ] || { echo "ERROR: no run command after --" >&2; usage; exit 2; }
[ -n "$ATTEMPT" ] && [ -n "$BLOCK" ] && [ -n "$LABEL" ] && [ -n "$MAX" ] && [ -n "$OUT" ] || {
  echo "ERROR: --attempt, --block, --label, --max and --out are required" >&2
  exit 2
}
if [ "$GIT" -eq 1 ]; then
  case "$OUT" in
    reports/final/*) ;;
    *) echo "ERROR: a git-anchored attempt must write under reports/final/ (A1 §1), got: $OUT" >&2; exit 2 ;;
  esac
fi

echo "final-run attempt $ATTEMPT: reserve max \$"$MAX" ($BLOCK / $LABEL)"
node scripts/final-budget.mjs reserve --attempt "$ATTEMPT" --block "$BLOCK" --label "$LABEL" --max "$MAX" --ledger "$LEDGER"

if [ "$GIT" -eq 1 ]; then
  git add "$LEDGER"
  git -c user.name=codeproof -c user.email=codeproof@local commit -q \
    -m "attempt $ATTEMPT: reserved \$"$MAX" USD ($BLOCK / $LABEL)"
  echo "final-run attempt $ATTEMPT: reservation anchored in git ($(git rev-parse --short HEAD))"
fi

mkdir -p "$OUT"
MARKER="$(mktemp "$OUT/.final-run-marker.XXXXXX")"
STARTED_AT="$(date -u +%s)"
echo "final-run attempt $ATTEMPT: running: $*"
set +e
"$@"
RUN_EXIT=$?
set -e
FINISHED_AT="$(date -u +%s)"
echo "final-run attempt $ATTEMPT: run exited $RUN_EXIT after $((FINISHED_AT - STARTED_AT)) s"

# The run creates exactly one directory under --out (src/cli.mjs: <out>/<runId>; ablation:
# <out>/held-out-<sha>). Anything else is ambiguous and leaves the audit to fail loudly later.
ARTIFACTS="$(find "$OUT" -mindepth 1 -maxdepth 1 -type d -newer "$MARKER" -print | sort)"
rm -f "$MARKER"
ARTIFACT=""
COUNT=0
if [ -n "$ARTIFACTS" ]; then
  COUNT="$(printf '%s\n' "$ARTIFACTS" | wc -l | tr -d ' ')"
  ARTIFACT="$(printf '%s\n' "$ARTIFACTS" | tail -n 1)"
  if [ "$COUNT" -gt 1 ]; then
    echo "WARN: $COUNT new run directories under $OUT (expected 1):" >&2
    printf '%s\n' "$ARTIFACTS" >&2
  fi
else
  echo "WARN: no new run directory under $OUT; settling as unknown-cost" >&2
fi

SETTLE=(node scripts/final-budget.mjs settle --attempt "$ATTEMPT" --exit-code "$RUN_EXIT" --ledger "$LEDGER")
if [ -n "$ARTIFACT" ]; then SETTLE+=(--artifact "$ARTIFACT"); fi
"${SETTLE[@]}"

if [ "$GIT" -eq 1 ]; then
  git add "$LEDGER"
  if [ -n "$ARTIFACT" ]; then git add "$OUT"; fi
  git -c user.name=codeproof -c user.email=codeproof@local commit -q \
    -m "attempt $ATTEMPT: settle + artifacts ($BLOCK / $LABEL, exit $RUN_EXIT)"
  echo "final-run attempt $ATTEMPT: settled and committed ($(git rev-parse --short HEAD))"
fi

exit "$RUN_EXIT"
