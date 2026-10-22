#!/usr/bin/env bash
# Start Deephaven without Docker (macOS / Linux). Needs Python 3.10+ and Java 17+.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
exec python run_server.py "$@"
