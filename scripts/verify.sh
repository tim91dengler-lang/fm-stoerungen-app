#!/usr/bin/env bash
#
# scripts/verify.sh — local mirror of the CI-blocking checks (.github/workflows/ci.yml).
#
# Purpose: close the feedback loop BEFORE pushing / before asking Tim for acceptance.
# Mirrors exactly what CI gates on, with change-detection so it only runs the relevant
# half (and is a no-op for pure text/docs changes).
#
# Used by the Stop hook in .claude/settings.json: it blocks "done" until green.
#   - Diagnostics/progress go to STDERR (visible when run manually).
#   - On failure, a Stop-hook decision JSON goes to STDOUT and the script exits 2.
#   - On success, STDOUT stays empty and the script exits 0.
#
# pytest needs a Postgres test DB (see apps/api/tests/conftest.py). It runs only when
# that DB is actually reachable; otherwise it is skipped (CI is the hard backstop).
# Force it with VERIFY_REQUIRE_PYTEST=1. DB connection is overridable via VERIFY_PG*.
#
# Manual use:  bash scripts/verify.sh           (auto-detects changed areas)
#              VERIFY_ALL=1 bash scripts/verify.sh   (check both areas regardless)

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '%s\n' "$*" >&2; }

fails=()

# run <label> <workdir> <command-string>  — runs cmd, records failure, output → stderr
run() {
  local label="$1" wd="$2" cmd="$3"
  log "▶ $label"
  if ( cd "$wd" && eval "$cmd" ) 1>&2; then
    log "  ✓ $label"
  else
    fails+=("$label")
    log "  ✗ $label"
  fi
}

# --- Change detection --------------------------------------------------------
# Collect: branch commits since merge-base with main, working-tree changes, untracked.
base=""
for ref in origin/main main; do
  if git rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
    base="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
    [ -n "$base" ] && break
  fi
done

if [ -n "$base" ]; then
  changed="$(
    git diff --name-only "$base" HEAD
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  )"
else
  changed="$(
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  )"
fi
changed="$(printf '%s\n' "$changed" | sort -u)"

backend_changed=false
frontend_changed=false
if [ "${VERIFY_ALL:-0}" = "1" ]; then
  backend_changed=true
  frontend_changed=true
else
  printf '%s\n' "$changed" | grep -qE '^apps/api/.*\.py$'       && backend_changed=true
  printf '%s\n' "$changed" | grep -qE '^apps/web/.*\.(ts|tsx)$' && frontend_changed=true
fi

if ! $backend_changed && ! $frontend_changed; then
  log "verify: keine Code-Änderungen (.py / .ts / .tsx) — übersprungen."
  exit 0
fi

# --- Is the Postgres test DB reachable with CI-style creds? ------------------
pytest_db_ready() {
  command -v psql >/dev/null 2>&1 || return 1
  PGPASSWORD="${VERIFY_PGPASSWORD:-postgres}" psql \
    -h "${VERIFY_PGHOST:-localhost}" -p "${VERIFY_PGPORT:-5432}" \
    -U "${VERIFY_PGUSER:-postgres}" -d "${VERIFY_PGDATABASE:-fm_stoerungen_test}" \
    -tAc 'select 1' >/dev/null 2>&1
}

# --- Backend (mirrors CI job "backend") --------------------------------------
if $backend_changed; then
  log "── Backend (apps/api) ──"
  run "ruff check"          apps/api "uv run ruff check ."
  run "ruff format --check" apps/api "uv run ruff format --check ."
  run "mypy"                apps/api "uv run mypy src"
  run "bandit"              apps/api "uv run bandit -q -r src"
  if pytest_db_ready; then
    run "pytest"            apps/api "uv run pytest"
  elif [ "${VERIFY_REQUIRE_PYTEST:-0}" = "1" ]; then
    fails+=("pytest (Test-DB nicht erreichbar — VERIFY_REQUIRE_PYTEST=1 erzwingt)")
    log "  ✗ pytest — Test-DB nicht erreichbar, aber erzwungen"
  else
    log "  ⚠ pytest übersprungen — Test-DB nicht erreichbar (CI prüft es)."
    log "    Erzwingen: Dev-Stack starten + VERIFY_REQUIRE_PYTEST=1."
  fi
fi

# --- Frontend (mirrors CI job "frontend") ------------------------------------
if $frontend_changed; then
  log "── Frontend (apps/web) ──"
  if [ ! -d apps/web/node_modules ]; then
    fails+=("node_modules fehlt — 'npm ci' in apps/web")
    log "  ✗ node_modules fehlt"
  else
    run "eslint"    apps/web "npm run lint --silent"
    run "typecheck" apps/web "npm run typecheck --silent"
    run "vitest"    apps/web "npm test --silent"
    # build (tsc -b && vite build) ist speicherhungrig. Auf RAM-knappen Dev-Boxen
    # (z. B. neben VS Code) killt der OOM-Killer den Build — das ist KEIN Code-Fehler.
    # Daher lokal nur bauen, wenn genug RAM frei ist; sonst überspringen (CI baut mit
    # genug RAM und ist der harte Build-Gate). Erzwingen: VERIFY_FORCE_BUILD=1.
    avail="$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')"
    if [ "${VERIFY_FORCE_BUILD:-0}" != "1" ] && [ -n "$avail" ] && [ "$avail" -lt 1200 ]; then
      log "  ⚠ build übersprungen — nur ${avail} MB RAM frei (<1200), OOM-Gefahr. CI baut. Erzwingen: VERIFY_FORCE_BUILD=1."
    else
      run "build" apps/web "npm run build"
    fi
  fi
fi

# --- Verdict -----------------------------------------------------------------
if [ "${#fails[@]}" -gt 0 ]; then
  summary="$(printf '%s; ' "${fails[@]}")"
  summary="${summary%; }"
  log ""
  log "✗ verify FEHLGESCHLAGEN: $summary"
  # Stop-hook contract: structured decision on stdout AND exit 2 (cover both mechanisms).
  printf '{"decision":"block","reason":"verify rot: %s. Fuehre scripts/verify.sh aus und mache alles gruen, bevor du fertig meldest."}\n' "$summary"
  exit 2
fi

log "✓ verify grün."
exit 0
