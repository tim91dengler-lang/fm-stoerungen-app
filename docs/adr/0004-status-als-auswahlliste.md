# ADR 0004 — Ticket-Status als Auswahlliste statt Postgres-ENUM

- **Status:** Akzeptiert
- **Datum:** 2026-05-21
- **plattform-relevant:** ja (Auswahllisten-Engine = Plattform-Kandidat 2)

## Kontext

Slice 1 hat `tickets.status` als Postgres-ENUM (`ticket_status`) mit harten Werten implementiert. Tim wünscht für Slice 2 (Entscheidung 2026-05-21):

1. Status-Bezeichnungen sollen umkonfigurierbar sein, damit Joachim z. B. eigene Wörter („In Bearbeitung", „Wartet auf Mieter") einsetzen kann, ohne Code-Änderung.
2. Auch andere Aufzähltypen (Priorität, Kategorie, Wartet-auf-Grund, Anlagen, Kontaktrollen, …) sollen über die gleiche Engine laufen — zentrale Stammdatenpflege.

## Optionen

**A — ENUM beibehalten, Labels frontend-seitig übersetzen.**
- ⊕ Einfach, keine Schema-Änderung
- ⊖ Werte selbst (Slug) bleiben hardcoded; neuer Status erfordert Migration + Deploy
- ⊖ Joachim kann nichts konfigurieren

**B — Status als Auswahlliste (FK zu `auswahllisten_werte`).**
- ⊕ Werte und Labels vollständig zur Laufzeit konfigurierbar
- ⊕ Eine Engine für alle Aufzähltypen (Status, Prio, Kategorie, …)
- ⊕ Pflege im Admin-UI statt Migration
- ⊖ FK statt ENUM = etwas teurere Queries (Join auf `auswahllisten_werte`), bei unserer Größenordnung vernachlässigbar
- ⊖ Status-Transitions müssen anders implementiert werden (siehe Konsequenzen)

**C — JSON-Lookup in einer Tabelle ohne FK.**
- ⊕ Sehr flexibel
- ⊖ Keine Referenzintegrität, FK-Constraints helfen nicht beim Löschschutz

## Entscheidung

**Option B** (Tim, 2026-05-21).

## Konsequenzen

### Datenmodell

Neue Tabellen (Migration Slice 2):

```sql
-- Die Auswahllisten selbst (Status, Prio, Kategorie, …)
CREATE TABLE auswahllisten (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id  UUID NOT NULL REFERENCES mandanten(id) ON DELETE CASCADE,
  key         VARCHAR(64) NOT NULL,             -- 'ticket_status', 'ticket_prioritaet', …
  label       VARCHAR(200) NOT NULL,
  beschreibung TEXT,
  ist_system  BOOLEAN NOT NULL DEFAULT FALSE,   -- System-Listen können nicht gelöscht werden
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mandant_id, key)
);

-- Die einzelnen Werte je Liste
CREATE TABLE auswahllisten_werte (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auswahlliste_id UUID NOT NULL REFERENCES auswahllisten(id) ON DELETE CASCADE,
  key             VARCHAR(64) NOT NULL,        -- stabiler Schlüssel, z. B. 'neu', 'pruefung'
  label           VARCHAR(200) NOT NULL,       -- Anzeige-Text, konfigurierbar
  reihenfolge     INT NOT NULL DEFAULT 0,
  farbe           VARCHAR(32),                  -- Tailwind-Farb-Token oder Hex
  ist_aktiv       BOOLEAN NOT NULL DEFAULT TRUE,
  ist_system      BOOLEAN NOT NULL DEFAULT FALSE,
  meta            JSONB,                        -- z. B. `darf_nach: ['erledigt', 'wartet']`
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auswahlliste_id, key)
);
```

`tickets.status` Migration:

- alter Spalte: `status ticket_status NOT NULL` (ENUM)
- neuer Spalte: `status_id UUID NOT NULL REFERENCES auswahllisten_werte(id)`
- Migration: für jeden alten Status-Wert wird der entsprechende `auswahllisten_werte`-Eintrag (Liste `ticket_status`, key z. B. `neu`) angelegt, dann `UPDATE tickets SET status_id = …`, dann alte ENUM-Spalte droppen, dann ENUM-Typ droppen.
- Aktuell 0 Tickets auf Staging → Daten-Migration trivial.

System-Listen, die Slice 2 anlegt:
- `ticket_status` mit Werten `neu, pruefung, bearbeitung, wartet, erledigt` (Mockup-Sprache)
- `ticket_prioritaet` mit Werten `niedrig, mittel, hoch, kritisch`
- `ticket_kategorie` mit ~6 Default-Werten (Heizung, Sanitär, Elektro, Aufzug, Allgemein, Sicherheit) — Joachim kann ergänzen

### Status-Transitions

Slice 2 hält **harte Transitions im Service-Layer** auf Slug-Basis:

```python
INVALID_TRANSITIONS: set[tuple[str, str]] = {
    ("erledigt", "neu"),
    ("erledigt", "pruefung"),
    ("erledigt", "bearbeitung"),
}
```

Statt `(TicketStatus.GESCHLOSSEN, TicketStatus.NEU)`. Lookup geht über `auswahllisten_werte.key`.

Konfigurierbare Transitions (gespeichert im `meta`-JSONB) kommen **frühestens Slice 4**, wenn echte Workflow-Anforderungen kommen.

### Schutz vor Löschung

- `auswahllisten_werte.ist_system = TRUE` für die fünf Standard-Status-Werte. UI verhindert Löschen.
- Wert mit referenzierenden Tickets kann nur **deaktiviert** (`ist_aktiv = FALSE`), nicht gelöscht werden (FK `RESTRICT`).

### Pattern-Konsistenz

- Folgt Pattern „[Auswahllisten als Default](../patterns/auswahllisten-default.md)" — alles Aufzähl-/Stammdaten-mäßige geht als Auswahlliste.
- Folgt Pattern „[Konsistente Migration](../patterns/konsistente-migration.md)" — bei Status-Migration werden Backend, Frontend, Tests, Mockup alle mitgezogen.

## Bezug

- [Konzept Slice 2](../../01_plan/Konzept_Slice2_UX-Sprung_2026-05-21.md) Abschnitt 2 + 9
- [ADR 0001 — Plattform-Anker-Strategie](0001-plattform-anker-strategie.md) Kandidat-Liste
- [Pattern: Auswahllisten als Default](../patterns/auswahllisten-default.md)
