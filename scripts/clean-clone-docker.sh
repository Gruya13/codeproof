#!/usr/bin/env bash
# Same check inside the official Node 22 image. Requires a working Docker daemon
# (on this host the user is not in the docker group yet: run with sudo or add the
# user to the group and re-login).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "Clean-clone check inside node:22-alpine"
docker run --rm -i -v "$ROOT:/src:ro" node:22-alpine sh -c '
  apk add --no-cache git make >/dev/null 2>&1
  git clone -q /src /work
  cd /work
  echo "  node $(node --version)"
  make test > /tmp/test.log 2>&1 && tail -2 /tmp/test.log
  make demo > /tmp/demo.log 2>&1 && echo "  demo ok"
  make score RUN=reports/golden > /tmp/score.log 2>&1 && echo "  score ok"
  test -z "$(git status --porcelain)" && echo "  PASS"
'
