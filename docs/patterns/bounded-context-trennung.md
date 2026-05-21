# Pattern: Bounded Contexts — `core/` vs. anwendungsspezifisch

**Plattform-relevant:** ja
**Status:** Verbindlich ab Tag 1. Siehe [ADR 0001](../adr/0001-plattform-anker-strategie.md).

## Einsatzgebiet

Die gesamte Code-Basis ist nach zwei Welten getrennt:

| Schicht | Inhalt | Beispiele |
|---------|--------|-----------|
| `core/` | wiederverwendbar, FM-frei | Listen/Power-Layout, Auswahllisten-Engine, Adresse, Geschäftspartner, Benutzer/Rolle, Audit, RBAC, Notifications, In-App-Hilfe, LLM-Gateway, Dokumente |
| `fm-tickets/` | anwendungsspezifisch (FM-Domäne) | Ticket, Fehlercode, Objekt → Haus → Stockwerk → Einheit, Anlagen, Wartet-Gründe, Mieter-Logik |

Verbindlich für **Frontend** (`apps/web/src/`) und **Backend** (`apps/api/src/`).

## Verbindliche Regel

`fm-tickets/` darf aus `core/` importieren, **nie umgekehrt**. Diese Regel wird **als ESLint-Regel und Python-Import-Lint** verankert, CI bricht bei Verstoß.

## ESLint-Setup (Frontend)

```json
// .eslintrc.json (Auszug)
{
  "plugins": ["boundaries"],
  "settings": {
    "boundaries/elements": [
      { "type": "core", "pattern": "src/core/**" },
      { "type": "fm",   "pattern": "src/fm-tickets/**" }
    ]
  },
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "allow",
      "rules": [
        { "from": "core", "disallow": ["fm"] }
      ]
    }]
  }
}
```

## Python-Import-Lint (Backend)

Via `import-linter` oder `ruff`-Custom-Regel:

```toml
[tool.importlinter]
root_packages = ["fm_app"]

[[tool.importlinter.contracts]]
name = "core darf nicht aus fm importieren"
type = "forbidden"
source_modules = ["fm_app.core"]
forbidden_modules = ["fm_app.fm"]
```

## Wie umsetzen

Pro Modul:

- **Eigene Tests** (Unit + Integration) **ohne FM-spezifische Fixtures** — Tests sollen auch in einer fremden App laufen
- **Eigenes README pro core-Modul** mit Schnittstelle, Tests, Migration-Hinweisen
- **ADR pro nicht-triviale Schnittstellen-Entscheidung** mit `plattform-relevant: ja`
- **Pattern in `docs/patterns/`** dokumentiert

## Vorteil bei der nächsten App

- `core/` wird **kopiert** (oder später als npm-Paket extrahiert)
- `fm-tickets/` wird durch das neue Domain-Modul ersetzt
- Datenmodell-Patterns (Audit, Soft-Delete, Mandantenfähigkeit, Auswahllisten-Tabellen) sind ohnehin Plattform-Konzepte und wandern mit

## Stolperfallen

- **Verlockung „nur ein kleiner Import" aus core in fm**: Lint-Regel erlaubt das. Verlockung „nur ein kleiner Import" aus fm in core: Lint-Regel erlaubt das **nicht**. Wenn der Drang stark ist, ist das Modul falsch geschnitten — neu sortieren statt umgehen.
- **`shared`-Schicht ist KEIN Ausweg.** `packages/shared/` enthält Schemas/Typen die FE+BE teilen, nicht FM-Domain-Logik. Auch dort gilt: keine FM-spezifischen Typen.
- **Tests-Setup darf NICHT FM-Daten als Default haben** — sonst sind `core`-Module nicht App-frei.

## Trigger für Extraktion zu npm-Paketen

Erst wenn folgendes eintritt (siehe [ADR 0001](../adr/0001-plattform-anker-strategie.md) Kapitel 13.5 der Tech-Spec):

1. Zweite zahlende Software-Anwendung in Sicht
2. Drittes Mal Power-Layout extrahiert — Pattern hat sich bewährt
3. Drittes Mal Adress-Modul kopiert — Schnittstelle ist stabil
4. Externe Devs / Junior-Entwickler im Team — Wartbarkeit per Library wichtiger als per Konvention

Bis dahin: Disziplin reicht, Distribution ist Overkill.
