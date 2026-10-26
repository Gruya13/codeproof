#!/usr/bin/env bash
# Isolated clean-clone check: clone the repository into a fresh temp directory,
# run with a stripped environment (env -i), then run the tests, the mock demo and
# the golden scorer, and verify that the working tree stays clean.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="$ROOT"
if [ -n "$REPO" ]; then SOURCE="$REPO"; fi
NODE_BIN_ARG="$NODE22"
KEEP_FLAG="$KEEP"
TMP="$(mktemp -d /tmp/codeproof-clean-XXXXXX)"
cleanup() {
  if [ "$KEEP_FLAG" = "1" ]; then echo "  kept: $TMP"; else rm -rf "$TMP"; fi
}
trap cleanup EXIT

echo "Clean-clone check"
echo "  source  $SOURCE"
echo "  tmpfs   $TMP"
git clone -q --no-hardlinks "$SOURCE" "$TMP/clone"
cd "$TMP/clone"
echo "  commit  $(git rev-parse HEAD)"

if [ -n "$NODE_BIN_ARG" ]; then
  NODE_BIN="$NODE_BIN_ARG"
else
  NODE_BIN="$(command -v node)"
fi
NODE_DIR="$(dirname "$NODE_BIN")"
echo "  node    $("$NODE_BIN" --version) ($NODE_BIN)"
mkdir -p "$TMP/home"

run_isolated() {
  env -i PATH="$NODE_DIR:/usr/local/bin:/usr/bin:/bin" HOME="$TMP/home" TMPDIR="$TMP" "$@"
}

echo "  step    1/3 make test"
run_isolated make test > "$TMP/test.log" 2>&1 || { tail -20 "$TMP/test.log"; exit 1; }
tail -3 "$TMP/test.log" | sed "s/^/          /"
echo "  step    2/3 make demo"
run_isolated make demo > "$TMP/demo.log" 2>&1 || { tail -20 "$TMP/demo.log"; exit 1; }
grep -E "run-id|Cost" "$TMP/demo.log" | sed "s/^/          /" || true
echo "  step    3/3 make score RUN=reports/golden"
run_isolated make score RUN=reports/golden > "$TMP/score.log" 2>&1 || { tail -20 "$TMP/score.log"; exit 1; }
grep -E "recall|precision|traps|False refutations" "$TMP/score.log" | sed "s/^/          /" || true

STATUS="$(git status --porcelain)"
if [ -n "$STATUS" ]; then
  echo "  FAIL    working tree is not clean after the run:"
  echo "$STATUS" | sed "s/^/          /"
  exit 1
fi
echo "  PASS    tests, demo and golden score pass from a clean clone with a stripped environment"
