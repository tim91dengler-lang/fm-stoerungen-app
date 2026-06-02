# Konzept — Feldtyp-Registry (selbst-etablierende Feld-Standards)

- **Projekt:** fm-stoerungen-app
- **Stand:** 2026-06-02
- **Status:** freigegeben (Tim, 2026-06-02) — Phase 2 nach QA-Gate #150
- **Bezug:** ADR `0006-feldtyp-registry` · Memory `phase2-feldtyp-registry` · Plan `wir-haben-immer-ft-pure-island`

---

## Kontext / Befund

Tims Ausgangsfrage war: *Wie etablieren sich neue Standards für Felder künftig von selbst?* Die Analyse (2026-06-02) zeigt: **Sie tun es heute nicht — weil Feld-Logik dupliziert ist.** Ein neuer Feld-Standard muss an vielen Stellen nachgezogen werden:

- **Ticket-Felder** werden in **drei** Renderer-Registries parallel definiert, jeweils nach `feld_key`:
  - `DETAIL_RENDERERS` (`components/ticket/detailFieldRenderers.tsx`) — Anzeige/Inline-Edit, State über `onPatch`
  - `CREATE_RENDERERS` (`components/ticket/createFieldRenderers.tsx`) — Erfassen, State über `setField`
  - `INPUT_RENDERERS` (`components/VorlagePreviewFelder.tsx`) — Designer-Vorschau (read-only)
  - Dasselbe Feld nutzt teils **verschiedene Komponenten** je Modus (z. B. `objekt`: Detail `FeldSearchSelect` vs. Create `EntitySearchSelect`).
- **Listen-Spalten + Filter** werden in **7+ Seiten** je einzeln gebaut (`TicketsListePage`, `ObjektePage`, `PartnerPage`, `AnlagenPage`, `AdressenPage`, `FehlercodesPage`, `ProjektePage`): pro Seite eine `columns`-`useMemo`, ein `filterRenderers`-Objekt und `massEditOptions`.

**Aufwandsbilanz heute:** ein Feld-Control ändern = 2–3 Dateien · ein neues Feld = 5–7 Dateien · einen Listen-Filter-Typ überall ändern = **7+ Seiten / ~800–1000 Zeilen**.

**Architektonische Kernerkenntnis:** Es gibt **kein explizites Konzept „Feldtyp"**. Der Typ (Text, Datum, Auswahlliste, Entitäts-Referenz, …) steckt **implizit** im `feld_key` plus hartcodierter Renderer-Logik. `TickettypFeld` (Backend) kennt nur `feld_key`, `label`, `sichtbar`, `pflicht`, `reihenfolge`, `block_id` — **kein `feldtyp`**.

> Duplizierung ist der Feind selbst-etablierender Standards: Solange dieselbe Logik mehrfach existiert, *kann* ein Standard sich nicht von allein durchsetzen — es gibt keine „eine Stelle", die man ändert.

**Bereits gut:** Die Block-Engine (`TicketFormEngine`) ist schon modus-agnostisch (nimmt einen `renderFeld`-Callback). Zentrale Bausteine existieren: `PowerListenView`, `ComboboxFilter`/`SelectFilter`/`TextFilter` (`core/liste/columnFilters.tsx`), `StatusBadge`/`PrioBadge`, der Backend-Feldkatalog `DEFAULT_SYSTEM_FELDER`. Es fehlt die **Klammer**, die Feldtyp → Rendering an *einer* Stelle bündelt.

---

## 1. Ziel

Ein neuer Feld-Standard = **eine Stelle ändern** → gilt automatisch in jedem Modul, jedem Formular, jeder Liste, jedem Filter. Konkret: Aus „2–7 Dateien + 7 Seiten" wird „1 Registry-Eintrag".

## 2. Scope

**In diesem Konzept:**
- Eine explizite **Feldtyp-Taxonomie** (ein überschaubarer Satz von Typen).
- Eine zentrale **`fieldTypeRegistry`** (Frontend), die pro Feldtyp **alle fünf Oberflächen** liefert: Erfassen-Eingabe · Detail-Inline-Edit · Designer-Vorschau · **Listen-Zelle** · **Filter-Control** (+ `filterFn`, Massen-Edit-Typ).
- Konsolidierung der 3 Ticket-Renderer-Registries **und** der Listen-Spalten/Filter der 7 Seiten gegen diese eine Quelle.
- Selbst-Propagations-Mechanik: Lint-Wächter, Codemod-Rollout, „Standard etablieren"-Skill, Drift-Audit.

**Nicht in dieser Iteration (bewusst später):**
- Verpflichtendes Backend-Attribut `feldtyp` inkl. Migration/Backfill (siehe Entscheidung §4 — kommt erst mit nutzerdefinierten Custom-Feldern).
- Server-seitige Spalten/Filter (bleibt Client-side wie ADR 0003).
- Rich-Text- oder neue Feldtypen, die es heute nicht gibt.

## 3. Architektur

### 3.1 Feldtyp-Taxonomie (Vorschlag)

| Typ | Beispiel-Felder | Erfassen / Detail | Listen-Filter |
|-----|------------------|-------------------|---------------|
| `text` | titel | Text-Input | Combobox/Text |
| `longtext` | beschreibung | Textarea | Text |
| `date` | faelligkeit_am | **DatePicker** | Datum-Vergleich (≤) |
| `select` | kategorie, quelle, prio*, status* | gestyltes Single-Select (Auswahlliste) | Multi-Select |
| `multiselect` | (Partner-Typen, künftige) | `MultiSelectCombobox` | Multi-Select |
| `entity_ref` | objekt, projekt, fehlercode, anlage | `EntitySearchSelect` | Combobox |
| `number` | (künftige Kennzahlen) | Number-Input | `NumberFilter` (≥) |
| `boolean` | aktiv | Toggle | `ToggleFilter` |
| `badge_enum` | status, prio | (über `select`) | Multi-Select, Zelle = `StatusBadge`/`PrioBadge` |
| `custom` | partner/beteiligte, pin, foto, dokumente, adresse, objekt→haus→stockwerk→einheit-Kaskade | bespoke Widget | bespoke / kein Filter |

\* `prio`/`status` sind Auswahllisten mit farbigem Badge → Sonderfall `badge_enum`.

**Realismus — der `custom`-Notausgang:** Verbund-/Spezialfelder (Beteiligte, Grundriss-Pin, Foto-Galerie, Dokumente, die Objekt-Kaskade) passen in **kein** generisches Schema. Sie bleiben bespoke, werden aber **ebenfalls** in der Registry registriert (per `feld_key` statt per Typ) — die Registry ist die *eine* Anlaufstelle, auch für Sonderfälle. Ziel ist, die ~80 % einfachen Felder generisch zu machen, nicht 100 % zu erzwingen.

### 3.2 Das Registry-Interface (Skizze)

Eine Quelle, fünf Oberflächen — pro Feldtyp einmal definiert:

```ts
// apps/web/src/core/felder/fieldTypeRegistry.tsx
export interface FieldTypeDef<TValue = unknown> {
  // Formular-Oberflächen (lösen DETAIL_/CREATE_/INPUT_RENDERERS ab)
  input:   (ctx: FieldInputCtx<TValue>) => React.ReactNode;   // Erfassen
  inline:  (ctx: FieldInlineCtx<TValue>) => React.ReactNode;  // Detail-Inline-Edit
  preview: (field: FieldMeta) => React.ReactNode;             // Designer (disabled)
  // Listen-Oberflächen (lösen per-Page columns/filterRenderers ab)
  listCell:   (value: TValue, row: unknown) => React.ReactNode;
  listFilter: (props: FilterProps) => React.ReactNode;        // aus core/liste/columnFilters
  filterFn?:  FilterFn | 'includesString' | 'arrIncludesSome';
  massEdit?:  { type: 'text' | 'auswahl' | 'combobox' | 'boolean' };
  icon?: React.ComponentType;
}

export const FIELD_TYPES: Record<FieldType, FieldTypeDef> = { /* eine Definition je Typ */ };
```

Die schon modus-agnostische `TicketFormEngine` ruft weiter ihren `renderFeld(feld, block)`-Callback — dieser delegiert künftig an `FIELD_TYPES[typeOf(feld)].input|inline`. Listen-Seiten reichen nur noch `{ id, header, type, accessor }` durch; `listCell`/`listFilter`/`filterFn`/`massEdit` kommen aus der Registry.

### 3.3 Wie ein Feld zu seinem Typ kommt

- **Ticket-Felder:** ein kleiner Frontend-Katalog `feldKey → FieldType` (heute fixe 19 System-Felder, korrespondiert mit Backend `DEFAULT_SYSTEM_FELDER`). Verbundfelder → `custom`.
- **Listen-Spalten (alle Module):** jede Spalte deklariert ihren `type` (+ optional Override). Die Registry liefert Zelle, Filter, `massEdit`.

## 4. Kern-Entscheidung — wo lebt der „Feldtyp"?

| Option | Beschreibung | ⊕ / ⊖ |
|--------|--------------|-------|
| **A** | Typ bleibt implizit (Status quo) | ⊖ löst das Problem nicht — verworfen |
| **B** | Neues Backend-Attribut `TickettypFeld.feldtyp` (Enum) + Migration + Backfill + Provisioning; Frontend-Registry liest es | ⊕ end-to-end, nötig für *nutzerdefinierte* Felder · ⊖ DB-Migration + Daten-Backfill + Risiko, ohne dass es heute (fixer System-Katalog) gebraucht wird |
| **C** | Frontend-Typ-Katalog (`feldKey → type` im Code) + Registry; Backend unverändert | ⊕ kein Migrations-Risiko, sofort wirksam, voller Konsolidierungs-Gewinn · ⊖ Typ-Wissen vorerst im Frontend (genügt, solange Felder ein fixer System-Katalog sind) |

**Empfehlung: C jetzt, B später.** Den hohen Konsolidierungs-Nutzen ohne DB-Migration heben; das Backend-`feldtyp` erst einführen, wenn **echte Custom-Felder** (nutzerdefiniert) kommen — dann wird es zur Quelle, die dieselbe Registry speist. So wird das Risiko sequenziert: erst die wertstiftende Vereinheitlichung, später (bei echtem Bedarf) die Datenmodell-Erweiterung.

## 5. Roll-out & Selbst-Propagation (das eigentliche Ziel)

1. **Lint-Wächter** (baut auf der Native-Controls-Regel aus #150 auf): Feld-Controls dürfen nur aus der Registry kommen — direkt gebaute Controls außerhalb werden abgelehnt → alter Weg merge-unmöglich.
2. **Codemod** (z. B. `jscodeshift`): die 7 Listen-Seiten werden in *einem* Lauf auf die Registry umgestellt, nicht von Hand.
3. **„Standard etablieren"-Skill** (`.claude/skills/standard-etablieren/`): Checkliste, die „fertig" für einen neuen/​geänderten Feld-Standard definiert — (1) Registry-Eintrag, (2) Lint-Wächter, (3) Bestand per Codemod, (4) Pattern-Doc + Memory, (5) `reuse-first`-Tabelle.
4. **Drift-Audit:** Scan „welche Spalte/welches Feld rendert noch an der Registry vorbei?" (Skript oder periodischer Review).

## 6. Migrations-Reihenfolge & Aufwand (grob)

| Sub-Phase | Inhalt | Aufwand |
|-----------|--------|---------|
| **2a** | Registry + Taxonomie + Frontend-Typ-Katalog; die 3 Ticket-Renderer-Registries (Detail/Create/Preview) dahinter konsolidieren | ~2–3 PT |
| **2b** | Listen-Spalten/Filter der 7 Seiten per Codemod aus der Registry ableiten | ~2 PT |
| **2c** | Lint-Wächter + „Standard etablieren"-Skill + Drift-Audit | ~1 PT |
| **2d** *(später, bei Custom-Feldern)* | Backend `feldtyp` (Option B) als dann maßgebliche Quelle | ~1–2 PT |

Jede Sub-Phase ist ein eigener PR, einzeln auf Staging abnehmbar; Regression abgesichert durch die bestehenden Tests (`detailFieldRenderers.test`, `detail.test`, `vorlageLayout.test`, `TicketFormEngine.test`) + visuellen Smoke-Test.

## 7. Risiken / Realismus

- **Visuelle Regressionen:** Detail/Create nutzten teils unterschiedliche Controls/Styles fürs selbe Feld → Vereinheitlichung kann Optik minimal verschieben. Gegenmittel: Sub-Phase 2a feldweise, Smoke-Test je Modul.
- **Verbundfelder** lassen sich nicht generisch fassen → bewusst `custom` (kein Zwang zur Schein-Generalisierung).
- **Zwei „objekt"-Komponenten** (FeldSearchSelect/EntitySearchSelect) werden auf eine vereinheitlicht — Verhalten (Kaskaden-Reset) muss erhalten bleiben.

## 8. Entscheidungen (Tim, 2026-06-02)

1. **Backend-Timing:** **Option C jetzt, B später** — Feldtyp-Katalog + Registry im Frontend, keine DB-Migration; Backend-`feldtyp` erst bei nutzerdefinierten Feldern.
2. **Sub-Phasen-Schnitt:** **2a + 2b in einem PR** (Ticket-Renderer *und* Listen-Spalten/Filter zusammen), danach 2c (Wächter/Skill/Drift), 2d später.
3. **Verortung:** `apps/web/src/core/felder/` als neuer Plattform-Baustein — ok.

---

*Freigegeben 2026-06-02. Umsetzung: 2a+2b in einem PR, dann 2c; je Staging-Abnahme. 2d (Backend `feldtyp`) erst bei echten Custom-Feldern.*
