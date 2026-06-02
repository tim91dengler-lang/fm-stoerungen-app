#!/usr/bin/env bash
#
# scripts/format-changed.sh — PostToolUse(Edit|Write) auto-formatter.
#
# Reads the hook JSON from stdin, extracts tool_input.file_path, and runs the
# matching formatter/auto-fixer on JUST that one file. Comfort layer only — it
# must NEVER block Claude's work, so it always exits 0 and swallows tool output.
# (Full lint/type/build verification lives in scripts/verify.sh via the Stop hook.)

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

input="$(cat)"
f="$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", "") or "")
except Exception:
    print("")' 2>/dev/null)"

[ -n "$f" ] || exit 0
[ -f "$f" ] || exit 0

case "$f" in
  *apps/api/*.py)
    ( cd "$ROOT/apps/api" \
        && uv run ruff format "$f" >/dev/null 2>&1 \
        && uv run ruff check --fix "$f" >/dev/null 2>&1 ) || true
    ;;
  *apps/web/*.ts | *apps/web/*.tsx)
    ( cd "$ROOT/apps/web"
      [ -x node_modules/.bin/eslint ]   && node_modules/.bin/eslint --fix "$f" >/dev/null 2>&1
      [ -x node_modules/.bin/prettier ] && node_modules/.bin/prettier --write "$f" >/dev/null 2>&1
    ) || true
    ;;
esac

exit 0
