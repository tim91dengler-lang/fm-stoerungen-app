# ADR 0006 — Feldtyp-Registry als zentrale Quelle für Feld-Rendering

- **Status:** Akzeptiert (Tim, 2026-06-02)
- **Datum:** 2026-06-02
- **plattform-relevant:** ja (Plattform-Kandidat, siehe ADR 0001 — `core/felder/`)

## Kontext

Feld-Rendering ist heute dupliziert: Ticket-Felder leben in **drei** Renderer-Registries (`DETAIL_RENDERERS`, `CREATE_RENDERERS`, `INPUT_RENDERERS`, je nach `feld_key`), Listen-Spalten + Filter werden in **7+ Seiten** je einzeln gebaut. Ein Feld-Standard ändern kostet 2–7 Dateien bzw. ~800–1000 Zeilen über alle Listen. Es gibt **kein explizites Konzept „Feldtyp"** — der Typ steckt implizit im `feld_key` + hartcodierten Renderern; `TickettypFeld` (Backend) hat kein `feldtyp`-Attribut.

Damit setzen sich neue Standards **nicht von selbst** durch (Tims Phase-2-Frage). Voraussetzung dafür ist eine *einzige* Stelle, die Feldtyp → Rendering bündelt. Volle Analyse: `docs/concepts/Konzept_Feldtyp-Registry_2026-06-02.md`.

## Optionen

Die Kern-Frage ist **wo der Feldtyp lebt**:

**A — Implizit lassen (Status quo).**
- ⊖ Löst das Duplizierungs-/Propagations-Problem nicht. Verworfen.

**B — Backend-Attribut `TickettypFeld.feldtyp` (Enum) + Frontend-Registry.**
- ⊕ End-to-end maßgeblich; nötig, sobald **nutzerdefinierte** Felder existieren
- ⊖ DB-Migration + Daten-Backfill + Per-Mandant-Provisioning + Risiko — ohne heutigen Bedarf (Felder sind ein fixer System-Katalog)

**C — Frontend-Typ-Katalog (`feldKey → type`) + zentrale `fieldTypeRegistry`, Backend unverändert.**
- ⊕ Kein Migrations-/Datenrisiko, sofort wirksam, voller Konsolidierungs-Gewinn (3 Renderer-Registries + 7 Listen-Seiten → 1 Quelle)
- ⊖ Typ-Wissen vorerst im Frontend (ausreichend, solange Felder fixer System-Katalog sind)

## Entscheidung

**Option C jetzt, Option B später** (Tim, 2026-06-02). Umsetzung: Sub-Phasen **2a+2b in einem PR** (Tim-Wahl), 2c folgend, 2d später.

Eine zentrale `apps/web/src/core/felder/fieldTypeRegistry.tsx` definiert pro Feldtyp **alle fünf Oberflächen** (Erfassen-Eingabe, Detail-Inline, Designer-Vorschau, Listen-Zelle, Filter-Control + `filterFn`/Massen-Edit). Ticket-Felder und Listen-Spalten werden gegen diese Quelle konsolidiert. Verbund-/Spezialfelder (Beteiligte, Pin, Foto, Dokumente, Adresse, Objekt-Kaskade) bleiben als Typ `custom` registriert (Notausgang, keine Schein-Generalisierung).

Das Backend-Attribut `feldtyp` (Option B) wird **erst** eingeführt, wenn echte nutzerdefinierte Felder kommen — dann wird es zur maßgeblichen Quelle, die dieselbe Registry speist. So wird Risiko sequenziert: erst die wertstiftende Vereinheitlichung ohne Migration, später (bei Bedarf) die Datenmodell-Erweiterung.

Rule-of-Three (ADR 0001) greift bewusst nicht als Bremse: Feld-Rendering ist von Anfang an modul-übergreifend (Tickets + alle Stammdaten-Listen), also direkt Plattform-Baustein → `core/felder/`.

## Konsequenzen

### Was wir tun
1. `core/felder/fieldTypeRegistry.tsx` + Feldtyp-Taxonomie (`text`, `longtext`, `date`, `select`, `multiselect`, `entity_ref`, `number`, `boolean`, `badge_enum`, `custom`).
2. Die 3 Ticket-Renderer-Registries hinter die Registry legen (Sub-Phase 2a); `TicketFormEngine` bleibt unverändert (ruft weiter `renderFeld`).
3. Listen-Spalten/Filter der 7 Seiten per Codemod aus der Registry ableiten (2b) — Seiten liefern nur noch `{ id, header, type, accessor }`.
4. Selbst-Propagation: Lint-Wächter (Controls nur aus Registry, baut auf #150), „Standard etablieren"-Skill, Drift-Audit (2c).

### Was wir bewusst NICHT tun
- Keine Backend-Migration in Phase 2 (kein `feldtyp`-Attribut, kein Backfill) — bis Custom-Felder real werden.
- Keine Server-seitigen Spalten/Filter (bleibt Client-side wie ADR 0003).
- Keine erzwungene Generalisierung von Verbundfeldern (`custom` bleibt bespoke).

### Trigger für Wechsel zu Option B (Backend-`feldtyp`)
- Nutzerdefinierte Felder (Admin legt eigene Felder mit Typ an), oder
- ein zweiter Client (PWA/Mieter-Portal) braucht den Typ server-seitig.

## Aufwand

- 2a (Ticket-Renderer-Konsolidierung): ~2–3 PT
- 2b (Listen-Spalten/Filter per Codemod): ~2 PT
- 2c (Lint-Wächter + Skill + Drift-Audit): ~1 PT
- 2d (Backend `feldtyp`, später): ~1–2 PT

## Bezug

- [Konzept Feldtyp-Registry](../concepts/Konzept_Feldtyp-Registry_2026-06-02.md)
- [ADR 0001 — Plattform-Anker-Strategie](0001-plattform-anker-strategie.md)
- [ADR 0003 — Power-Layout (TanStack Table)](0003-power-layout-tanstack-table.md)
- [ADR 0004 — Status als Auswahlliste](0004-status-als-auswahlliste.md)
- [Pattern: Filter passend zum Feldtyp](../patterns/filter-passend-zum-feldtyp.md)
- QA-Gate (PR #150): Native-Controls-Lint + `reuse-first`-Skill als Grundlage des Lint-Wächters
