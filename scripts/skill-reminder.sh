#!/usr/bin/env bash
#
# scripts/skill-reminder.sh — UserPromptSubmit hook.
#
# If the user's prompt smells like UI / module / field / list work, append a short
# reminder to the model context (a UserPromptSubmit hook's stdout is added to context).
# Otherwise stay silent. This is a soft nudge; the hard gate is scripts/verify.sh.

set -uo pipefail

input="$(cat)"
prompt="$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("prompt", "") or "")
except Exception:
    print("")' 2>/dev/null)"

[ -n "$prompt" ] || exit 0

if printf '%s' "$prompt" | grep -qiE 'modul|liste|detail|crud|picker|auswahl|tabelle|formular|spalte|filter|feld'; then
  cat <<'EOF'
[Projekt-Reminder] UI-/Modul-/Feld-Arbeit erkannt:
- Skill `modul-standard` (Liste+Detail-Aufbau) und `reuse-first` (Komponenten-Inventar) nutzen.
- KEINE nativen Controls: Datum→DatePicker, Auswahl→EntitySearchSelect, Multi→MultiSelectCombobox, Liste→PowerListenView.
- Vor "fertig": `scripts/verify.sh` grün (Definition of Done oben in CLAUDE.md).
EOF
fi

exit 0
