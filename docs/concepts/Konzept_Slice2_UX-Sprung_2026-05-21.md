# Konzept Slice 2 — UX-Sprung: Sidebar, Power-Layout, Stammdaten-Foundation

**Stand:** 2026-05-21
**Status:** Entwurf — wartet auf Tim-Freigabe
**Vorgänger:** Slice 1 (Auth + Tickets-CRUD, live auf Staging)
**Quellen:** [plan.md](plan.md) Abschnitt 5.2 + 5.13, [Mockup](../02_draft/fm-stoerungen/), CLAUDE.md (Repo-Konvention für Listen), ADR 0001 (Plattform-Anker).

---

## 1. Ziel

Aus dem CRUD-Skeleton wird eine **App, die sich nach App anfühlt**:

- Echte Navigation links (Sidebar) statt schmaler Top-Bar.
- Listen mit echtem Power-Layout (Spalten ein/aus, Drag, Multi-Sort, Bulk, Filter pro Spalte, gespeicherte Ansichten).
- Erste Stammdaten-Schicht: **Adressen, Objekte, Geschäftspartner** — damit Tickets nicht mehr in der Luft hängen.
- Status-Werte angeglichen ans Mockup (Joachim-Sprache: `neu / prüfung / bearbeitung / wartet / erledigt`).

Nach Slice 2 ist die App **demo-fähig für Joachim** im Sinne von „so sieht's später aus, nur noch nicht alle Module".

---

## 2. Scope

### Drin in Slice 2

1. **Sidebar-Navigation** (Pattern aus Mockup), mobile collapsible.
2. **Power-Layout-Modul** als wiederverwendbares Plattform-Modul (`core/liste/`):
   - Spalten ein/aus mit Default-Sichtbarkeit
   - Drag-Reorder von Spalten
   - Multi-Sort (Shift+Klick, 3-Klick-Reset)
   - Bulk-Select als erste Spalte
   - Spalten-Filter passend zum Feldtyp (Text / Number ≥ / Multi-Select / Toggle)
   - Gesamt-Such-Feld
   - Gruppierungs-Zeile mit ↑↓-Pills
   - Kachel/Liste-Toggle (Default je View)
   - Gespeicherte Ansichten (in DB, pro User)
   - Treffer-Zähler (`gefiltert / gesamt`)
3. **Adress-Modul** (`core/adresse/`):
   - Tabelle `adressen` (id, strasse, hausnummer, adresszusatz, plz, ort, land, bemerkung)
   - CRUD + Combobox + Modal + PLZ-Validierung
   - Listen-View mit Power-Layout
4. **Objekte-Modul flach** (`fm-tickets/stammdaten/objekte/`):
   - Tabelle `objekte` (id, name, adresse_id FK, mandant_id)
   - n:m Verknüpfung zu Geschäftspartnern (Eigentümer / Auftraggeber)
   - Listen-View mit Power-Layout, Detail-View mit Partner-Sektion
5. **Geschäftspartner-Modul** (`fm-tickets/stammdaten/partner/`):
   - Tabelle `geschaeftspartner` (id, name, ansprechpartner, email, telefon, adresse_id, notiz, mandant_id)
   - n:m mit Typen `mieter / eigentuemer / auftraggeber / nachunternehmer`
   - Listen-View, Filter nach Typ
6. **Auswahllisten-Modul** (`core/auswahllisten/`):
   - Tabellen `auswahllisten` + `auswahllisten_werte`
   - Engine als zentrale Konfig-Quelle für Status, Prio, Kategorie, Anlagen, Wartet-Gründe
   - Read-only API für alle, Admin-CRUD für Werte (Reihenfolge, Farbe, aktiv-Flag)
7. **Ticket-Erweiterung**:
   - Neue FK-Felder: `objekt_id` (nullable, Stufe 1 optional), `partner_id` (nullable), `kategorie_id` (FK Auswahlliste)
   - Status-Werte-Migration: `zugewiesen → bearbeitung` (semantisch passender), neu `pruefung` + `wartet` dazu, `geschlossen` raus (Joachim braucht keinen Unterschied erledigt/geschlossen)
   - Detail-UI um Objekt-/Partner-/Kategorie-Combobox erweitert
8. **Tests + E2E**:
   - Backend-Integration-Tests für alle neuen Endpoints
   - Frontend-Vitest für Power-Layout-Hook
   - Playwright E2E: Login → Objekt anlegen → Ticket mit Objekt-Bezug → Liste filtern → Ansicht speichern → re-login → Ansicht wieder da

### Nicht drin (→ Slice 3+)

- **Hierarchie Haus / Stockwerk / Einheit + Grundriss + Pin** (Slice 3 — größerer Brocken für sich)
- **Dokumente-Modul** mit Drag-Drop, Preview, `.msg`-Parser (Slice 3 oder 4)
- **Chat / Notifications / Bell-Dropdown** (Slice 4)
- **Fehlercodes / EBO-Vorlagen** (Slice 5, vor EBO-Anbindung)
- **Tickettypen** (Reparatur / Wartung / Baubegehung — Slice 5)
- **Projekte** (Sammelposten, Slice 6)
- **Dashboards** (Admin + Techniker — Slice 6)
- **KI-Light** (Klassifizierung, Duplikat-Suche — Slice 7)
- **Mobile-Optimierung / PWA** (Slice 8, vor Pilot-Go-Live)

---

## 3. Architektur

### Bounded Contexts (gemäß ADR 0001)

| Modul | Pfad | Plattform-relevant? |
|---|---|---|
| Power-Layout | `apps/web/src/core/liste/` | **ja** (Plattform-Kandidat 1) |
| Adresse | `apps/web/src/core/adresse/` + `apps/api/src/fm_api/modules/adresse/` | **ja** (Plattform-Kandidat 3) |
| Auswahllisten | `apps/web/src/core/auswahllisten/` + `apps/api/src/fm_api/modules/auswahllisten/` | **ja** (Plattform-Kandidat 2) |
| Objekte | `apps/web/src/fm-tickets/stammdaten/objekte/` | nein (FM-spezifisch) |
| Geschäftspartner | `apps/web/src/fm-tickets/stammdaten/partner/` | teilweise (Stamm-Pattern plattform, Typen FM-spezifisch) |

### Power-Layout — technische Wahl

**Empfehlung: TanStack Table v8 als Engine, eigene UI-Schicht.**

- Headless, ~50 KB minified — vertretbarer Bundle-Zuwachs.
- Battle-tested, große Community, modular (man lädt nur was man braucht).
- Eigene Tailwind-UI darüber, damit das Look-and-feel zu uns passt.
- Alternative wäre Eigenbau — würde 3–4 zusätzliche PT kosten und ist Premature-Reinvention.

### DB-Schema-Erweiterung

Neue Tabellen:
- `adressen` (eigene Entität, n:1 referenziert von objekte / haus / partner)
- `objekte` (mandant_id, name, adresse_id, …)
- `geschaeftspartner` (mandant_id, name, ansprechpartner, email, telefon, adresse_id, notiz, …)
- `geschaeftspartner_typen` (Junction-Tabelle: partner_id × `mieter|eigentuemer|auftraggeber|nachunternehmer`)
- `objekt_partner` (n:m: welche Partner sind welchem Objekt zugeordnet)
- `auswahllisten` (key, label, beschreibung)
- `auswahllisten_werte` (auswahlliste_id, key, label, reihenfolge, farbe, aktiv)
- `gespeicherte_ansichten` (user_id, view_key, name, config_json, ist_default)

Erweiterung `tickets`:
- + `objekt_id` UUID NULL FK objekte
- + `partner_id` UUID NULL FK geschaeftspartner
- + `kategorie_id` UUID NULL FK auswahllisten_werte

Status-Migration:
- Bestehende `tickets.status`-ENUM-Werte (`neu/zugewiesen/in_arbeit/erledigt/geschlossen`) ersetzt durch `neu/pruefung/bearbeitung/wartet/erledigt`.
- Daten-Migration: existierende Tickets bekommen `zugewiesen → bearbeitung`, `in_arbeit → bearbeitung`, `geschlossen → erledigt`. Aktuell sind 0 Tickets auf Staging, daher unkritisch.
- ENUM-Typ wird in Migration mit `ALTER TYPE` umgebaut (Postgres unterstützt Add/Rename, kein Drop einzelner Werte — daher neuer Typ + Datenkopie).

### Audit-Trigger
Alle neuen Schreib-Tabellen bekommen den `audit_trigger` aus Slice 1 (Pattern audit-trigger-postgres).

---

## 4. API-Endpunkte (neu)

| Methode | Pfad | Beschreibung | Auth |
|---|---|---|---|
| GET / POST / PATCH / DELETE | `/api/v1/adressen[/{id}]` | Adress-CRUD | User |
| GET | `/api/v1/adressen/search?q=` | Combobox-Suche | User |
| GET / POST / PATCH / DELETE | `/api/v1/objekte[/{id}]` | Objekte-CRUD | User |
| GET / POST / PATCH / DELETE | `/api/v1/partner[/{id}]` | Partner-CRUD | User |
| GET | `/api/v1/partner?typ=mieter` | Partner-Filter nach Typ | User |
| GET | `/api/v1/auswahllisten` | Alle Listen lesen | User |
| GET | `/api/v1/auswahllisten/{key}` | Eine Liste mit Werten | User |
| POST / PATCH / DELETE | `/api/v1/auswahllisten/{key}/werte[/{wert_id}]` | Werte verwalten | Admin |
| GET / POST / PATCH / DELETE | `/api/v1/ansichten[/{id}]` | Gespeicherte Ansichten | User (eigene) |
| Bestehend, erweitert | `/api/v1/tickets` | Filter um `objekt_id`, `partner_id`, `kategorie_id` ergänzt | User |

OpenAPI wird automatisch durch FastAPI generiert.

---

## 5. UX-Skizze

```
┌────────────────────────────────────────────────────────────┐
│ [Logo] FM-Störungen                       [Suche]  [User] │
├──────────┬─────────────────────────────────────────────────┤
│ Tickets  │ ┌─Tickets─────────────────────────────────────┐ │
│ ─── ─── ─│ │ [Suche...]  [Status: neu, prüfung] [Spalten] │
│ Stammd.. │ │ [Gruppieren: Status ↓] [Neue Ansicht spei..] │
│  Objekte │ │ ┌─────┬──────┬────────┬──────┬─────────────┐ │
│  Partner │ │ │ ☐ │ Nr. │ Titel │ Status│ Objekt      │ │
│  Adress. │ │ ├─────┼──────┼────────┼──────┼─────────────┤ │
│ ─── ─── ─│ │ │ ☐ │ #1  │ Heiz..│ neu  │ Schweizer 88│ │
│ Auswahl. │ │ │ ☐ │ #2  │ Aufzug│ wart.│ Schweizer 88│ │
│ ─── ─── ─│ │ └─────┴──────┴────────┴──────┴─────────────┘ │
│ Benutzer │ │  3 von 5 gefiltert                            │
│          │ └───────────────────────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────────┘
```

Mobil: Sidebar als Off-Canvas-Drawer hinter Hamburger-Icon. Power-Layout-Tabelle scrollt horizontal, Spalten-Ausblende-Menü hilft.

---

## 6. Akzeptanzkriterien

- [ ] Sidebar links, mit allen aktuellen Hauptbereichen + Submenu für Stammdaten
- [ ] Tickets-Liste hat alle 5 Säulen aus CLAUDE.md (View-Toggle, Suche, Spalten-Filter, Spalten ein/aus, Treffer-Zähler) + Drag-Reorder + Multi-Sort + Bulk-Select + Gruppierung + gespeicherte Ansichten
- [ ] Adressen, Objekte, Partner anlegen / bearbeiten / löschen funktioniert
- [ ] Tickets-Detail zeigt Objekt + Partner + Kategorie als Combobox (mit Inline-Anlegen-Option für Adresse aus Combobox)
- [ ] Auswahllisten-Werte können vom Admin gepflegt werden, andere Nutzer sehen sie nur
- [ ] Gespeicherte Ansicht überlebt Logout / Login
- [ ] Status-Werte sind `neu / prüfung / bearbeitung / wartet / erledigt`
- [ ] Alle CI-Stationen grün (inkl. neuer Endpoint-Tests)
- [ ] E2E Playwright-Test läuft durch
- [ ] Tim hat Staging-Acceptance gemacht

---

## 7. Aufwand-Indikation

| Block | PT |
|---|---|
| Sidebar + Layout | 2 |
| Power-Layout-Modul (TanStack Table + UI) | 5 |
| Adress-Modul (Backend + Frontend) | 2 |
| Objekte-Modul flach (Backend + Frontend) | 2 |
| Partner-Modul (Backend + Frontend) | 2 |
| Auswahllisten-Engine (Backend + Frontend) | 3 |
| Ticket-Erweiterung (FKs + UI + Migration) | 2 |
| Status-ENUM-Migration | 1 |
| Gespeicherte Ansichten | 2 |
| Tests + E2E | 3 |
| **Summe** | **~24 PT** |

→ ca. **3 Wochen** meiner Zeit. Größer als Slice 1 (war ~12 PT), aber liefert auch deutlich mehr Sichtbares.

### Schlanke Alternative (~12 PT, 1,5 Wochen)

Falls 3 Wochen zu lang sind:

- Sidebar + Power-Layout-Vollausbau (NUR für Tickets-Liste)
- NUR Adress-Modul als erstes Stammdaten-Modul
- Status-Migration ans Mockup
- Ticket-Detail-Politur

Objekte + Partner + Auswahllisten → Slice 3.

---

## 8. Risiken

- **TanStack Table Bundle-Zuwachs** — ~50 KB minified. Vertretbar; falls Bundle-Größe ein Problem wird (Mobile-LTE), lazy-loaden.
- **Status-Migration ist Breaking-Change** — alte API-Clients (gibt es nicht außer Frontend) müssen mit. Lösung: Slice 2 deployt Backend + Frontend zusammen. Aktuell 0 Tickets auf Staging → unkritisch.
- **Auswahllisten-Engine als FK** — Auswahllisten-Werte sind FK von `tickets.kategorie_id`. Löschen eines Werts wird durch FK-Constraint geblockt (`RESTRICT`) oder mit Soft-Delete (`aktiv = false`) gelöst. Letzteres ist der weichere Weg.
- **Adressen + Geocoding** — wenn Stufe-1-Geocoding gewünscht (z. B. Nominatim oder Hetzner-internes Geo), kommt das in einer eigenen Iteration. Für Slice 2 reicht reine Adress-CRUD ohne Geo.
- **PowerLayout in Mobile** — Tabellen sind horizontal-scroll-anfällig. Wir testen auf realem Smartphone, bevor Slice 2 als done markiert wird.

---

## 9. Tim-Entscheidungen (2026-05-21)

1. **Voll** — kompletter UX-Sprung, ~3 Wochen.
2. **Status-Bezeichnungen sind egal** — können später umbenannt werden, weil als Auswahlliste konfigurierbar.
3. **Status als Auswahlliste** — kein eigener Postgres-ENUM mehr, sondern FK zu `auswahllisten_werte`. Macht spätere Joachim-Anpassungen trivial.
4. **International vorbereitet** mit Land-Feld + per Land konfigurierbarem PLZ-Format. Plus Adress-Vorschlagsfunktion (Geocoding-Service).
5. **Geocoding mitmachen** in Slice 2 (Vorschlag + lat/lng-Speicherung). Anbieter-Entscheidung in ADR 0005.
6. **Gespeicherte Ansichten mitmachen** in Slice 2.

### Folge-Implikation aus Punkt 3 (Status als Auswahlliste)

- `tickets.status` wird `status_id UUID FK auswahllisten_werte` statt ENUM.
- Status-Transitions (z. B. „kann nicht von erledigt zurück auf neu") müssen entweder
  - **a)** hardcoded auf Slug-Basis bleiben (`if alter_status.key == 'erledigt' && neuer_status.key == 'neu' → block`), oder
  - **b)** konfigurierbar im Auswahllisten-Wert hinterlegt werden (Felder `darf_nach: [list of status_keys]`).
- Empfehlung: **a)** für Slice 2 (einfach), **b)** ab Slice 4 wenn echte Workflow-Engine kommt.

### Folge-Implikation aus Punkt 4 + 5 (Geocoding)

- Backend bekommt einen Proxy-Endpoint `/api/v1/adressen/suggest?q=Schweizer+Straße+88` der einen Geocoding-Service aufruft und Treffer mit Adress-Felder + lat/lng zurückgibt.
- Adress-Tabelle bekommt `latitude` + `longitude` als optionale Felder.
- Bei Combobox-Eingabe: nach 300 ms Debounce → Suggest-Call → Vorschlags-Liste → Auswahl füllt Felder automatisch.
- Service-Wahl (Photon / Nominatim / Geoapify / Mapbox) in ADR 0005 — Kriterien: EU-Hosting (DSGVO), Rate-Limit für unsere Größenordnung, Kosten.

---

## 10. Nächste Schritte nach deinem OK

1. ADR 0003 — Power-Layout-Architektur + TanStack-Table-Entscheidung
2. Slice-2-Issue im GitHub-Repo mit Akzeptanzkriterien
3. Branch `slice-2-ux-foundation` + erste Migration (Adressen + Auswahllisten)
4. Schritt für Schritt umsetzen, kontinuierlich pushen, PRs durch CI-Gate
5. Auf Staging deployen, Tim klickt durch
