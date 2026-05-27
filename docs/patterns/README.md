# Pattern-Library

Wiederverwendbare Patterns aus dem FM-Projekt, die als Plattform-Bausteine in künftige Apps wandern (siehe [Plattform-Anker-ADR](../adr/0001-plattform-anker-strategie.md)).

## Pflegeregel

**Rule of Three:** Wer ein Pattern zum dritten Mal kopiert, schreibt es als Pattern-Datei aus. Pro Pattern eine Markdown-Datei mit fester Struktur:

- **Pattern-Name** und Einsatzgebiet
- **Wann anwenden** — Kriterien
- **Wie umsetzen** — Schritte mit Code-Beispielen
- **Beispiel-Implementierung im Code** (Link auf Datei/Zeile)
- **Stolperfallen** — was nicht funktioniert, warum
- **Plattform-relevant: ja|nein** — analog zu ADRs

## Bestand (aus Mockup-Phase abgeleitet, im Produktiv-Bau zu verfeinern)

| Pattern | Kurzfassung | Status |
|---------|-------------|--------|
| [power-layout.md](power-layout.md) | Listenansichten mit Drag-Reorder, Multi-Sort, Bulk-Edit, gespeicherten Ansichten | Konzept |
| [listen-power-2.md](listen-power-2.md) | UX-Polish auf Power-Layout: visuelle Ruhe, Schaltflächen-Diät, Skalierungs-Fundament, Sperren-vs-Delete | Konzept (Pilot TicketsListePage) |
| [auswahllisten-default.md](auswahllisten-default.md) | Stammdaten in Tabellen, nicht im Code — pflegbar zur Laufzeit | Konzept |
| [filter-passend-zum-feldtyp.md](filter-passend-zum-feldtyp.md) | UI-Filter automatisch aus Feldtyp ableiten (Auswahlliste → Multi-Select) | Konzept |
| [konsistente-migration.md](konsistente-migration.md) | Bei Feld-Änderungen alle Referenzen (Formular, Filter, Suche, Mobile) mitziehen | Konzept |
| [audit-trigger-postgres.md](audit-trigger-postgres.md) | Globales Audit-Log über Postgres-Trigger und Session-Variablen | Konzept |
| [combobox-mit-inline-anlegen.md](combobox-mit-inline-anlegen.md) | Adresse/Partner/Anlage „neu anlegen" direkt aus jeder Auswahl | Konzept |
| [bounded-context-trennung.md](bounded-context-trennung.md) | `core/` vs. `fm-tickets/` — Lint-Regel statt Disziplin | Konzept |
