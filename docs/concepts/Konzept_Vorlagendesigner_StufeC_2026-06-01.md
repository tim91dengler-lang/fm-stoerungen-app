# Konzept: Frei konfigurierbarer Vorlagen-Designer („Stufe C")

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-01 — Entwurf zur Freigabe
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** mehrgleisig erarbeitet (4 Ist-Karten → 3 unabhängige Architektur-Entwürfe →
> Synthese → adversariale Risikoprüfung). Die 6 HIGH-Risiken der Prüfung sind als „Härtung" eingearbeitet.
> **Bezug:** CLAUDE.md §4 (Listen-/Vorlagen-Konvention), `docs/concepts/Konzept_TicketPool_2026-05-31.md`
> (vorlagengetriebenes Ticket), Memories `migration-expand-contract-drop`, `tenant-provisioning-base-data`,
> `fk-mandant-validierung`, `audit-trigger-junction-tables`, `konsistente-migration`.

---

## 0. Begriffe (einmalig, für die Nicht-Programmierer-Sicht)

- **Datengetrieben rendern:** Das Ticket-Formular wird nicht mehr fest im Code „gemalt", sondern aus
  einer Konfiguration in der Datenbank zusammengebaut. Der Admin ändert die Konfiguration → das Ticket
  ändert sich mit.
- **Renderer-Registry:** eine Nachschlage-Tabelle „Feld-Name → wie wird dieses Feld gezeichnet". Die
  komplizierten Spezial-Bausteine (Objekt-Kaskade, Foto-Galerie …) bleiben **unangetastet** und werden
  nur von dort aufgerufen.
- **Migration:** einmaliges, automatisches Umschreiben bestehender Daten auf das neue Modell.
- **Feature-Flag:** ein Schalter, mit dem man die neue Render-Logik an-/ausknipsen kann, ohne neu zu
  deployen — Sicherheitsnetz für den riskantesten Schritt.

---

## 1. Ziel

Der Admin kann im Vorlagen-Designer **eigene Blöcke frei anlegen, benennen, löschen, in zwei Spalten
(links/rechts) anordnen** und **Felder per Drag zwischen Blöcken und innerhalb eines Blocks
verschieben** — und das echte Ticket (Detail + Erfassen) sieht **genau so aus**. Ausgeliefert werden
zwei schlanke Standard-Vorlagen plus eine **„Alles-Vorlage"**, die jedes existierende Feld enthält und
**neue Felder automatisch mitführt**, sobald der Katalog wächst.

Strategisch: Damit wird das Ticket zur **einen datengetriebenen Render-Engine** — heute dreifach
gepflegt (Detail-Panel, Erfassen-Modal, Designer-Vorschau). Das ist der Hebel für die `core/`-Plattform
(spätere eigene Produkte / Mehrmandanten-Customizing).

---

## 2. Datenmodell (alle Änderungen additiv — nichts Bestehendes wird zerstört)

### 2.1 Neue Tabelle `tickettyp_block`
Eine Block-Gruppierung pro Vorlage.

| Spalte | Typ | Zweck |
|---|---|---|
| `id` | UUID PK | |
| `tickettyp_id` | UUID FK → `tickettypen.id` (CASCADE, index) | gehört zu einer Vorlage |
| `block_key` | String(64) | stabile interne ID, pro Vorlage eindeutig |
| `label` | String(120) | frei umbenennbarer Anzeigename |
| `region` | String(16): `links` \| `rechts` | die zwei Spalten (Anforderung 2) |
| `reihenfolge` | Integer | Sortierung der Blöcke innerhalb der Region |
| `ist_system_block` | Boolean | UI-Schutz (z. B. `kopf`, `weitere`) |
| `collapsible_default_open` | Boolean | Accordion-Default im Detail-Panel |
| `created_at`/`updated_at` | TimestampMixin | |

`UniqueConstraint(tickettyp_id, block_key)`. `region` bewusst als String → später n Regionen ohne
Schema-Bruch.

### 2.2 Erweiterung `tickettyp_feld` (additiv)
- `block_id` UUID FK → `tickettyp_block.id`, **`ON DELETE SET NULL`**, nullable, index. SET NULL =
  Kern der Verlustfreiheit: Block gelöscht → Felder verlieren nur die Zuordnung, kein Feld geht je verloren.
- `reihenfolge` (bestehend) wird ab jetzt als **block-lokale** Reihenfolge interpretiert.
  **Wird NICHT gedroppt** (Expand/Contract, Memory `migration-expand-contract-drop`).

### 2.3 Erweiterung `tickettypen`
- `ist_alles_vorlage` Boolean default false.
- Partial-Unique-Index `uq_alles_vorlage_pro_mandant ON tickettypen(mandant_id) WHERE ist_alles_vorlage`
  → garantiert **genau eine** Alles-Vorlage pro Mandant.

### 2.4 Migration (idempotent + verlustfrei)
1. `CREATE TABLE IF NOT EXISTS tickettyp_block` + Unique + Index; `ADD COLUMN IF NOT EXISTS` für die drei
   neuen Spalten; Partial-Index `IF NOT EXISTS`.
2. **Backfill in reinem SQL:** pro bestehender Vorlage die System-Blöcke anlegen
   (`INSERT … WHERE NOT EXISTS`), dann jedes `tickettyp_feld` über die code-bekannte
   `feld_key → block_key`-Map seinem `block_id` zuordnen. Reihenfolge-Erhalt:
   `reihenfolge_im_block = ROW_NUMBER() OVER (PARTITION BY block ORDER BY alte reihenfolge)`.
   Ungemappte/Custom-Felder → `weitere`-Block (nicht NULL, s. **Härtung M4**).
3. **Audit-Trigger** explizit anlegen: `DROP TRIGGER IF EXISTS audit_tickettyp_block …; CREATE TRIGGER
   audit_tickettyp_block … EXECUTE FUNCTION audit_trigger()`. UUID-PK → einfacher Pfad, **kein**
   Junction-Composite-Trick (Memory `audit-trigger-junction-tables` greift hier nicht). **Härtung H6.**
4. Model in `models/__init__.py` importieren (sonst sieht `metadata.create_all` im Test es nicht).

### 2.5 Standard-Block-Layout (Default, gespiegelt aus dem heutigen Ticket)
| block_key | label | region | feld_keys |
|---|---|---|---|
| `kopf` | Kopf | links | titel |
| `problem` | Problem & Bearbeitung | links | beschreibung, faelligkeit_am, wiederholung |
| `beteiligte` | Kontakt & Beteiligte | links | partner |
| `verortung` | Verortung | links | objekt, haus, stockwerk, einheit, adresse, anlage, pin |
| `klassifizierung` | Klassifizierung | links | prio, kategorie, quelle, projekt, fehlercode |
| `belege` | Belege & Kommunikation | rechts | foto, dokumente |
| `chat` | Verlauf / Chat | rechts | (Pseudo-Feld, fest) |
| `weitere` | Weitere Felder | links | (Auffang, `ist_system_block`, nicht löschbar) |

---

## 3. Backend

### 3.1 Konsolidierter Feld-Katalog `core/feld_catalog.py` (neu — eine Wahrheit)
Heute ist die Feld-Wahrheit über vier Stellen verstreut (`DEFAULT_SYSTEM_FELDER`, `PREVIEW_BLOCKS`,
`INPUT_RENDERERS`, hartkodierte Sektionen). Stufe C bündelt sie:

```python
@dataclass(frozen=True)
class FeldDef:
    key: str; default_label: str; widget: str
    default_block_key: str
    detail_only: bool = False      # pin/foto/dokumente → im Erfassen nur Hinweis
    is_kernfeld: bool = False       # titel
    depends_on: tuple[str, ...] = ()
    null_strategy: ... = ...         # ersetzt FELD_NULL_CONFIG (Härtung H3)
FELD_CATALOG: dict[str, FeldDef] = { … 19 Einträge … }
```
**Ein neues Feld einführen = ein Eintrag hier.** `DEFAULT_SYSTEM_FELDER` wird daraus abgeleitet.

### 3.2 Service `tickettyp_service.py`
- `create_tickettyp()` / `duplicate_tickettyp()`: seeden/klonen jetzt zusätzlich Blöcke; beim
  Duplizieren `block_id`-Remap via key→id-Dict (**Härtung N1**: Test, dass Duplikat auf **eigene**
  Block-IDs zeigt, nie auf die der Quelle).
- **`save_layout(db, mandant_id, tickettyp_id, layout)`** — das *eine* transaktionale Schreib-Primitiv
  des Designers: Blöcke upserten (label/region/reihenfolge), gelöschte entfernen (außer geschützte);
  Felder `block_id` + `reihenfolge_im_block` + sichtbar/pflicht/label setzen; Kernfeld-Schutz
  (`titel` → sichtbar=pflicht=True, Block `kopf`). Neue Blöcke im Payload via `block_key` referenziert
  (kollisionsfrei), Service löst auf IDs auf.
- Altes `PATCH /felder` bleibt als Kompatibilitäts-Shim, entfällt nach Frontend-Umstieg.

### 3.3 Standard- + Alles-Vorlage
`ensure_default_vorlagen(mandant_id)` (idempotent, key-gegated) liefert **drei** Vorlagen:
`standard-stoerung`, `standard-wartung` und die Alles-Vorlage.

Die **Alles-Vorlage** hat keine eingefrorene Feldliste, sondern wird **reconciled**:
```python
async def ensure_alles_vorlage_vollstaendig(db, mandant_id):
    av = _get_alles_vorlage(db, mandant_id) or create_tickettyp(..., ist_alles_vorlage=True)
    have = {f.feld_key for f in av.felder}
    for key, fdef in FELD_CATALOG.items():
        if key not in have:
            db.add(TickettypFeld(... feld_key=key, sichtbar=True,
                   block_id=block_by_key.get(fdef.default_block_key) or weitere_block, ...))
    # ON CONFLICT (tickettyp_id, feld_key) DO NOTHING  → Race-Schutz
```
- **Trigger:** (a) im Provisioning neuer Mandanten **und** (b) lazy beim Lesen der Alles-Vorlage. Bewusst
  **lazy-on-read statt Startup-Loop** (skaliert, racet nicht mit Migrationen).
- In der Alles-Vorlage ist **Ausblenden gesperrt** (Service erzwingt `sichtbar=True`) → die „enthält
  alles"-Garantie bleibt wahr; Umsortieren/Umbenennen/Umblocken erlaubt.
- **Reconcile schreibt nur bei echtem Delta** (Set-Diff). **Härtung M1:** GET der Alles-Vorlage ist
  damit kein reiner Read mehr → entweder akzeptieren+dokumentieren, oder Reconcile aus dem GET ziehen und
  nur in Provisioning + Designer-Open. Default-Block fehlt? → `weitere`-Fallback, nie auf Existenz
  vertrauen (**Härtung N4**).

### 3.4 API `api/v1/tickettypen.py`
- `GET /{id}` und `GET /` liefern zusätzlich `bloecke[]`. **`_LOAD_OPTIONS` um `selectinload(bloecke)`
  erweitern** (sonst N+1 / MissingGreenlet — **Härtung M1**).
- **`PUT /{id}/layout`** ← `LayoutWrite` → `save_layout()` (primärer Designer-Save).
- `PATCH /{id}/felder` bleibt als Shim.
- **IDOR (Härtung M2):** `save_layout` validiert jede `block_id` UND jede `feld_key` gegen **genau diese**
  Vorlage (gehört-zu-tickettyp-gehört-zu-mandant); fremde Keys → 422/ignorieren, **nie** reparenten.
  Negativtest auch **Cross-Vorlage im selben Mandanten**, nicht nur Cross-Mandant
  (Memory `fk-mandant-validierung`).

---

## 4. Datengetriebenes Ticket-Rendering (eine Engine für Detail + Erfassen + Designer)

### 4.1 Renderer-Registry `components/ticket/fieldRenderers.tsx` (neu)
Pro `feld_key` ein Renderer, der Detail (persistent) und Erfassen (Formular-State) über einen
einheitlichen `ctx` bedient. **Das bestehende JSX wird nicht neu geschrieben, sondern 1:1 in
Registry-Zellen ausgeschnitten.** Die Spezial-Widgets (`BeteiligteBlock`, `TicketAdresseField`,
`GrundrissPin`, `PhotoGallery`, `TicketDokumente`, `ChatPanel`, `EntitySearchSelect`-Wrapper,
`WartetSubBar`) bleiben **unangetastet**.

> **Härtung H5 (das größte Risiko):** Erfassen nutzt react-hook-form + Zod (lokaler Form-State);
> Detail nutzt `defaultValue` + sofort-persistierende Mutationen pro Feld. Die Registry-Signatur muss so
> geschnitten sein, dass `mode='create'` weiter über die **bestehende RHF-Instanz** läuft und
> `mode='detail'` weiter pro-Feld persistiert — **kein Parallel-State**. Pflicht: Playwright-Parität
> gegen den Ist-Zustand für **beide** Modi vor Flag-on + Test „dynamische Pflichtprüfung == die 13 alten
> Checks".

### 4.2 Layout-Engine `components/ticket/TicketFormEngine.tsx` (neu)
Ersetzt die hartkodierten Sektionen: Blöcke nach `(region, reihenfolge)` → `links[]`/`rechts[]`; pro
Block die sichtbaren Felder nach `reihenfolge_im_block`; pro Feld `FIELD_RENDERERS[key] ?? FALLBACK`.
Leerer Block wird nicht gerendert. Auffang-Block `weitere` real (Härtung M4).

- **Regionen/Layout (Anforderung 6):** `links` → `lg:w-3/5`, `rechts` → `lg:w-2/5 lg:border-l`;
  bestehende Accordions bleiben 1:1.
- **Mobile-Reihenfolge folgt jetzt der Block-Reihenfolge** (statt hartkodierter `order-1..7`) →
  admin-steuerbar. **Härtung M5:** das ändert das heutige Interleaving (Belege rutschen mobil ans Ende)
  → bewusste, zu bestätigende Verhaltensänderung. Chat behält Sonderposition (fester Slot).

### 4.3 „Immer gerendert, NICHT designbar" — feste Slots (Härtung M6)
Nicht jedes Element ist ein Katalog-Feld. Folgende Elemente sind **feste Slots der Engine/Panel**,
unabhängig vom Designer: **Status + Status-Workflow-Buttons**, **Zugewiesen an**, **Wartet-Block**
(`wartet_grund`/`wartet_beteiligter`, conditional), **Chat**, **Verlauf/Timeline**, **Löschen**,
**Kopf** (Nummer/Titel/Prio). `status` ist heute kein Katalog-Feld — würde sonst beim Swap verschwinden.

### 4.4 Schalen
- `TicketDetailPanel` = Header-Slot + `<TicketFormEngine mode="detail">` + Footer-Slot. Die hartkodierte
  Sektions-Wand entfällt. Vorlage-Wechsel-Nullung (`FELD_NULL_CONFIG`) bleibt als key-basierte
  Rahmen-Logik (jetzt **aus dem Katalog abgeleitet**, Härtung H3).
- `TicketErfassenModal` = Vorlagen-Picker + `<TicketFormEngine mode="create">` + Submit. Pflichtprüfung
  dynamisch über `felder.pflicht()`.

### 4.5 Feature-Flag `vorlage_layout_v2`
Flag aus → alte hartkodierte Pfade; an → Engine. Default-on erst nach Tims Staging-Acceptance. Macht den
riskantesten Schritt sofort rückrollbar (Sicherheitsarchitektur Schicht 10).
> **Härtung M3:** Solange das Flag existiert, schreibt `save_layout` **beide** Sortier-Quellen (alte
> globale `reihenfolge` synthetisch aus Block×Feld-Reihenfolge), damit der Flag-aus-Pfad bei Rollback
> korrekt sortiert.

---

## 5. Designer-Builder-UI `components/VorlageLayoutBuilder.tsx` (ersetzt `VorlagePreviewFelder`)

**WYSIWYG:** zeigt exakt das Ticket (linke 3/5-, rechte 2/5-Spalte, gleiche Accordions, Felder via
Engine read-only) — nur mit Drag-Griffen und Editier-Chrome. Kein Drift mehr zwischen Vorschau und Ticket.

**dnd-kit (3 Ebenen, eine `DndContext`):** zwei Droppable-Regionen → je `SortableContext` von
Block-Karten; Block-Karte = sortierbar **und** Droppable-Container für Feld-Chips (innere
`SortableContext`).

Interaktionen: Block anlegen/umbenennen/löschen (mit „N Felder wandern nach ‚Weitere Felder'"); Block
zwischen Regionen ziehen; Block sortieren; **Feld zwischen Blöcken ziehen** (heutige Block-Grenzen-Sperre
fällt); Feld innerhalb Block sortieren; Sichtbar/Pflicht-Toggles; Palette „Ausgeblendete Felder".
`kopf` + Kernfeld `titel` mit Lock geschützt.

**Speichern:** lokaler State (optimistisch) → ein „Speichern" → `PUT /{id}/layout` (vollständiger,
idempotenter Layout-Put); Fehler → TanStack-Rollback.

**Alles-Vorlage:** Badge „Alle Felder · wächst automatisch"; voll editierbar, Felder **nicht entfernbar**
(nur ausblenden gesperrt).

---

## 6. Funktionale Constraints (Leitprinzip: Constraints hängen an `feld_key`, nicht an der Block-Position)

| Constraint | Lösung |
|---|---|
| Objekt-Kaskade (objekt→haus→stockwerk→einheit; anlage←objekt; fehlercode←anlage) | Logik in den Renderern + gemeinsamem `ctx.setOrt()` (Null-Propagation). `haus` bleibt disabled ohne `objekt`, egal in welchem Block. Layout-agnostisch (State global im `ctx`, nicht DOM-Nachbarschaft). |
| **Abhängiges Feld sichtbar, Eltern-Feld ausgeblendet** (Härtung H4) | (1) Renderer rendern einen **„Voraussetzung fehlt"-Zustand** (disabled + Hinweis), nicht nur leer. (2) `save_layout`-**Validierung**: führt eine Vorlage `pin/fehlercode/anlage/haus/stockwerk/einheit` sichtbar, müssen die Eltern (`stockwerk→haus→objekt`; `fehlercode→anlage→objekt`) ebenfalls sichtbar sein — sonst harte Designer-Warnung. Sonst baut der Admin unbedienbare Vorlagen. |
| detail-only (pin/foto/dokumente/chat) | `FeldDef.detail_only` → im `mode='create'` Hinweis statt Widget. |
| Wartet-Block / Status-Workflow | feste Slots (§4.3), nicht designbar. |
| Vorlage-Wechsel-Nullung | aus dem Katalog abgeleitet (Härtung H3), key-basiert, layout-agnostisch. |
| **Felderlose System-Vorlagen** (Härtung H2) | `ensure_system_tickettypen` seedet heute **keine** Felder → nach dem Swap würden reparatur/wartung/baubegehung alle 19 Felder im Auffang-Block zeigen. Pflicht: Backfill/Reconcile hebt auch die felderlosen System-Vorlagen auf Standard-Blöcke + Default-Felder (= bewusste Verhaltensänderung, zu bestätigen). |
| **Provisioning verdrahten** (Härtung H1) | `ensure_default_vorlagen` + `ensure_alles_vorlage_vollstaendig` werden in `seed_dev.py` UND `seed_mockup.py` direkt nach `ensure_system_tickettypen` aufgerufen (+ künftiger Tenant-Create-Endpoint). Smoke-Test „frischer Tenant → genau 1 Alles + 2 Standard + Blöcke". Lazy-on-read deckt nur die Alles-Vorlage. (Memory `tenant-provisioning-base-data`.) |
| Drift Katalog ↔ Renderer | Build-Time-Test `FELD_CATALOG.keys() ⊆ FIELD_RENDERERS.keys()` + `FELD_NULL_CONFIG ⊇ (Katalog ohne pflicht/kernfeld)`. Richtung sauber: **`CATALOG ⊆ RENDERERS`**, nicht `DB-Felder ⊆ CATALOG` (Altfelder wie `melder` dürfen in alten Zeilen bleiben — Härtung N3). |

---

## 7. Umsetzungsschnitt (Reihenfolge: Backend zuerst = nicht-brechend, dann Registry-Sicherung, dann Swap hinter Flag, dann Designer)

| PR | Inhalt | Größe | Risiko |
|---|---|---|---|
| **C1** | Datenmodell + Migration (`tickettyp_block`, `block_id`, `ist_alles_vorlage`), Read-Schemas, SQL-Backfill (verlustfrei), Audit-Trigger, `models/__init__`, Tests. **Kein UI-Change.** | M | niedrig |
| **C2** | `core/feld_catalog.py`, System-Blöcke, create/duplicate seeden Blöcke, `ensure_default_vorlagen` + `ensure_alles_vorlage` (lazy-on-read) **+ Verdrahtung in seed_dev/seed_mockup** (H1) **+ felderlose System-Vorlagen heben** (H2). Tests. | M | niedrig |
| **C3** | `PUT /{id}/layout` + `save_layout` (Block-CRUD, Feld→Block, Kernfeld-Schutz, **Doppel-IDOR-Guard** M2, Eltern-Sichtbarkeits-Regel H4). Tests inkl. Negativ. **Kein UI.** | M | niedrig–mittel |
| **C4** | Renderer-Registry (1:1-Extraktion, kein Verhaltenswechsel; RHF-vs-Detail sauber getrennt, H5). | M | mittel |
| **C5** | `TicketFormEngine` + Detail-Panel-Swap, datengetrieben, Auffang-Block. **Hinter Flag.** Playwright-Parität. | L | **hoch** |
| **C6** | Erfassen-Modal-Swap (`mode='create'`, dynamische Pflichtprüfung). Flag-gesteuert. E2E. | M | hoch |
| **C7** | `VorlageLayoutBuilder` (3-Ebenen-dnd-kit, Block-CRUD, Region-Move, Palette), Save via `/layout`. | L | mittel |
| **C8** | Flag default-on nach Staging-Acceptance, Shim/Alt-Pfade entfernen, ADR + Doku. | S | niedrig |

**Grobe Gesamtschätzung: ~12–15 Personentage, 8 PRs.** C1–C3 liefern Datenmodell + Designer-Backend,
**ohne das echte Ticket anzufassen** (Wert sofort, null Ticket-Regression). C5/C6 sind der einzige echte
Risikoblock — vollständig hinter Flag, mit Ist-Layout als Snapshot-Referenz, schrittweise statt Big-Bang.

---

## 8. Was bewusst NICHT in Phase 1
- Mehr als zwei Regionen (Tabs, Vollbreit-Kopf, mehrspaltige Blöcke). Datenmodell hält es offen.
- Echte Custom-Feld-**Typen** ohne Code-Renderer. Phase 1 platziert die 19 Katalog-Felder frei um;
  neue Feld-*Typen* brauchen weiter einen Renderer-Eintrag (Code-Release). Self-Service = **Platzierung**,
  nicht das Erfinden neuer Widgets.
- Pro-Feld-bedingte Sichtbarkeit („zeige fehlercode nur wenn Kategorie = X").
- Granulares Auto-Save (jeder Drag → API). Phase 1: ein „Speichern"-Button.
- `reihenfolge`-Spalte droppen (Expand/Contract — Cleanup später).
- Mandant-übergreifende Vorlagen-Bibliothek / Import-Export.

---

## 9. Offene Entscheidungen (Tim)
1. **Genau eine Alles-Vorlage pro Mandant** (Partial-Unique-Index)? → Empfehlung: **ja**.
2. **System-Blöcke außer `kopf` in Stufe C löschbar** (volle Freiheit)? → Empfehlung: **ja** (`kopf` +
   `weitere` geschützt).
3. **Alles-Vorlage: Ausblenden gesperrt** (nur umsortieren/umbenennen/umblocken)? → Empfehlung: **ja**
   (hält die „enthält alles"-Garantie wahr).
4. **System-Vorlagen (reparatur/wartung/baubegehung) bekommen jetzt echte Felder/Blöcke** (heute
   felderlos → sonst Layout-Kollaps beim Swap, H2)? → Empfehlung: **ja**.
5. **Mobile-Reihenfolge folgt künftig der Designer-Reihenfolge** (statt heutigem festen Interleaving,
   M5)? → Empfehlung: **ja**.

---

*Konzept zuerst. Bis zur Freigabe: kein Code. Start nach Freigabe mit PR **C1** (Datenmodell + Migration —
nicht-brechend, sofort staging-migrierbar).*
