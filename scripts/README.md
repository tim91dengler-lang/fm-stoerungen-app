# scripts/ — Qualitäts-Gate & Hook-Skripte

Diese Skripte verlagern Standards von „weicher" Dokumentation auf „harte", mechanisch
erzwungene Gates (siehe CLAUDE.md → „Definition of Done"). Verdrahtet in `.claude/settings.json`.

| Skript | Hook | Zweck |
|--------|------|-------|
| `verify.sh` | `Stop` | Spiegelt die CI-blockierenden Checks lokal (ruff/mypy/bandit/pytest + eslint/tsc/vitest/build). Blockiert „fertig", bis grün. Change-Detection: läuft nur für betroffene Bereiche, no-op bei reinen Text-/Doku-Änderungen. |
| `format-changed.sh` | `PostToolUse(Edit\|Write)` | Formatiert/fixt die gerade geänderte Datei (ruff bzw. eslint+prettier). Komfort, blockiert nie. |
| `skill-reminder.sh` | `UserPromptSubmit` | Nudge zu `modul-standard` + `reuse-first` bei UI-/Modul-/Feld-Arbeit. |

## `verify.sh` manuell

```bash
bash scripts/verify.sh            # prüft nur geänderte Bereiche (vs. main)
VERIFY_ALL=1 bash scripts/verify.sh   # beide Bereiche, unabhängig vom Diff
```

**pytest** braucht eine Postgres-Test-DB (`apps/api/tests/conftest.py`, DB `fm_stoerungen_test`,
User/PW `postgres`/`postgres` auf `localhost:5432`). Ist sie nicht erreichbar, wird pytest
übersprungen (CI ist der harte Backstop). Erzwingen mit `VERIFY_REQUIRE_PYTEST=1` (Dev-Stack
vorher starten). DB-Verbindung überschreibbar via `VERIFY_PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`.
