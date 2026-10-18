#!/usr/bin/env bash
# Optional independent skill-pack integration; does not alter Itskorrah/evolve.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
command -v git >/dev/null || { echo 'Install Git first'; exit 1; }
command -v python3 >/dev/null || { echo 'Install Python 3.10+ first'; exit 1; }
git clone --depth 1 https://github.com/Itskorrah/evolve.git "$TMP/evolve"
python3 "$TMP/evolve/scripts/install.py" install --host codex --project "$ROOT"
echo 'Evolve installed into local project skill folders (gitignored).'
