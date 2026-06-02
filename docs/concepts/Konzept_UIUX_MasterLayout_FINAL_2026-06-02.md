# Konzept: UI/UX-Master-Layout & Modul-Standard (FINAL, verbindlich)

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **freigegeben mit Tim** (nach Prototyp v2 + Feedback-Runden)
> **Status:** **VERBINDLICH.** Löst den Entwurf `Konzept_UIUX_Vereinheitlichung_2026-06-02.md` ab.
> **Geltung:** Alle **Daten-Module** (Tickets, Objekte, Geschäftspartner, Projekte, Adressen, Anlagen,
> Fehlercodes, …). **Ausgenommen:** Konfig-/Meta-Editoren (Vorlagen-Designer, Auswahllisten,
> Status-Workflow) und eigene Visualisierungen (Dashboard, Kanban) — die bekommen nur Shell + Header.
> **Durchsetzung:** Skill `modul-standard` (Bau-/Review-Checkliste) + CLAUDE.md §4 + dieses Dokument.

---

## 1. Ziel

Jedes Modul ist **gleich aufgebaut**, maximal UI/UX-freundlich, und **wächst ohne Layout-Umbau**
(neue Felder = Konfiguration, kein Rewrite). Wiedererkennbarkeit für die Sachbearbeiter, schnelles
Bauen neuer Module für die Entwicklung. **Diese Standardisierung ist ab jetzt Pflicht** — kein Modul
wird mehr von Hand „anders" gebaut.

## 2. Leitprinzipien

1. **Eine Engine, je Modul nur Daten.** Liste = `PowerListenView`. Detail = generische Block-Engine.
   Ein Modul liefert: Spalten-Definition · Feld-Katalog · Default-Block-Layout. Mehr nicht.
2. **Ebene auf Ebene.** Die **Liste ist immer die Basis**. Das Detail liegt **zentriert darüber**
   (Liste bleibt sichtbar). Verknüpfungen öffnen die **nächste Ebene** (wieder eine Liste). Zurück =
   Ebene schließen.
3. **Progressive Offenlegung.** Beim Öffnen ist nur das Wichtige offen, Seltenes/Kontext/Historie
   zugeklappt → bleibt schlank, egal wie viele Felder dazukommen.
4. **Verknüpfungen sind echte Listen, keine Spielzeug-Listen.** Jede n:m-/1:n-Beziehung (z. B.
   „verknüpfte Tickets") öffnet die **vollwertige** `PowerListenView` mit allen Funktionen, vorgefiltert.
5. **Keine erfundenen Felder.** Es wird nur gebaut, was im Datenmodell existiert. Vorschläge für neue
   Felder werden im Konzept als **(Vorschlag)** markiert und brauchen Tims Freigabe.

## 3. Das Schichten-Modell

```
   Ebene 1: MODUL-LISTE  (Basis — PowerListenView, volle Funktionen)
        │  Klick auf Zeile
        ▼
   Ebene 2: DATENSATZ-DETAIL  (zentriertes Overlay über der Liste, Block-Engine)
        │  Klick auf einen Verknüpfungs-Block / Chip „↗"
        ▼
   Ebene 3: VERKNÜPFTE LISTE  (wieder PowerListenView, vorgefiltert)
        │  Klick auf Zeile → Detail dieses Datensatzes …
        ▼
   (rekursiv weiter)        ✕ / Esc / „← zurück"  schließt je eine Ebene
```

## 4. Bausteine (alle in `apps/web/src/core/` — FM-frei, Plattform-Anker-konform)

| Baustein | Zweck |
|---|---|
| `PageShell` | Seiten-Wrapper, 2 Varianten: `list` (volle Breite) · `form` (zentriert max-w-5xl, für Konfig-Editoren) |
| `PageHeader` | Titel/Untertitel + Aktionen-Slot — **ein** Größen-Standard |
| `PowerListenView` | **existiert** — bleibt die einzige Listen-Engine (s. §5.1) |
| `useListenState` | kapselt ViewConfig/Default + Handler + Persistenz (entfernt das 9-fach-Boilerplate) |
| `DetailOverlay` | zentriertes Overlay über der Liste (Backdrop, Esc/✕, max-h 92vh); Breite: `panel`≈max-w-3xl · `page`≈max-w-6xl |
| `BlockEngine` | **generalisiert aus der Stufe-C `TicketFormEngine`** — rendert Regionen→Blöcke→Felder aus Katalog+Layout, Renderer-Registry je Feld; Auffang-Block „Weitere" |
| `RelationList` | Verknüpfungs-Block: Vorschau (3–5) + Zähler + „in Listenansicht öffnen" → öffnet Ebene 3 = `PowerListenView` vorgefiltert |

## 5. Verbindliche Regeln

### 5.1 Liste (Ebene 1) — Pflicht-Funktionsumfang
Jede Modul-Liste MUSS über `PowerListenView` laufen und folgende Funktionen haben (CLAUDE.md §4 +
Power-Layout): **Volltextsuche · Spaltenfilter (Typ passend zum Feld) · Sortierung (Multi via Shift,
3-Klick-Reset) · Gruppierung (↑↓-Pills) · gespeicherte Ansichten · Bulk-Auswahl-Spalte · Spalten
ein/ausblenden (SPALTEN_DEFINITION) · Treffer-Zähler (gefiltert/gesamt) · Power-Layout (Drag-Reorder)**.
**Keine Kachel-/Karten-Ansicht — ausschließlich Listen (Tim 2026-06-02).** Kein ViewModeToggle.

### 5.2 Detail (Ebene 2) — Aufbau
- Öffnet als **zentriertes Overlay** über der sichtbaren Liste. ✕ / Esc → zurück zur Liste.
- **Kopf:** Identität (Name/Nummer + Status-Badges) + Aktion „schließen".
- **Sprung-Chips** unter dem Kopf: Feld-Block → scrollt zur Sektion; Verknüpfungs-Block → öffnet Liste (Ebene 3).
  - **Pflicht-Verhalten (verbindlich, ergänzt 2026-06-02 nach Tim-Feedback):** Jeder Chip-Klick muss **sichtbares Feedback** geben — auch wenn der Inhalt komplett ins Fenster passt und physisch 0 px gescrollt wird. Mechanik in `core/detail` (`DetailNavProvider`/`DetailScroll`): (a) Zielblock **aufklappen** + **kurzer Flash** (`animate-detail-flash`), (b) **Scroll-Spy** (IntersectionObserver, root = innerer Scroll-Container) markiert den Chip des sichtbaren Blocks (`aria-current`). Der Scroll läuft gegen den **inneren Container-Ref**, nie gegen das Fenster. Verknüpfungs-Chips öffnen weiter die Liste, leuchten aber via `activeKey` mit.
  - **Klickbarkeit:** Verknüpfungs-Vorschauzeilen sind **klickbar** (`onItemClick` → Ziel-Detail), Block-Köpfe haben flächigen Hover. Read-only-Felder (bis Inline-Editing live ist) zeigen dezenten Border-Hover + `title="Bearbeiten folgt"` — **kein** Cursor-pointer/Stift, der „jetzt editierbar" verspricht.
- **Zwei Regionen:** **links = primär/handlungsrelevant (3/5)** · **rechts = Kontext/Status/Verknüpfungen/Chat (2/5)**.
- **Blöcke = Accordions** mit `default_offen`: häufig offen, selten/Historie zu (progressive Offenlegung).
- **Mobil:** einspaltiger Stapel (`singleColumn`), Links/Rechts fällt weg, große Touch-Ziele.

### 5.3 Panel vs. eigene Seite (= Overlay-Breite)
**Eine Frage:** „Hat der Datensatz eine eigene Navigations-/Hierarchie-Innenwelt?"
- **Nein** → **Panel** (schmaleres zentriertes Overlay). Default. → Ticket, Projekt, Adresse, Anlage, Fehlercode, Benutzer.
- **Ja** (Baum / viele Beziehungs-Listen) → **Seite** (breites Overlay, ggf. mit Tree links). → Objekt, Geschäftspartner.
- **Beide rendern denselben Block-Engine-Inhalt** — der Unterschied ist nur die Breite + ggf. ein Tree-Slot.

### 5.4 Tab vs. Sektion
- **Default = scrollende Block-Sektionen** (Accordion). Niemals ein Formular mit Tabs zerschneiden.
- **Echte Tabs/Listen-Ebene** nur für **eigenständige Verknüpfungs-Listen** (Partner→Objekte/Projekte/Tickets) oder einen eigenen Modus (Chat) — realisiert als Ebene-3-Liste bzw. fester Slot.

### 5.5 Verknüpfungen
Relations-Block zeigt **Vorschau + Zähler**; „in Listenansicht öffnen" → **Ebene-3-`PowerListenView`**,
vorgefiltert auf den Datensatz, mit **vollem** Funktionsumfang (§5.1). Skaliert auf beliebig viele Beziehungen.

### 5.6 „Historie"-Block (Pflicht je Datensatz)
Jeder Datensatz hat **rechts, zugeklappt** den Block **„Historie"**: `Angelegt am` · `Zuletzt geändert am`
· `Interne ID`. (Später erweiterbar um echte Audit-Spur.)

---

## 6. Modul-Skizzen (verbindliches Soll-Layout)

> Legende: **L/R** = Region links/rechts · **(offen/zu)** = Default-Aufklappzustand · **🔗** = Verknüpfungs-Block
> (öffnet Ebene-3-Liste) · **(Vorschlag)** = noch nicht im Datenmodell, braucht Freigabe.

### 6.1 Ticket — **Panel**
Identität: `#Nummer` + Titel · Status-Badge · Prioritäts-Badge
```
L (offen) Kopf                  Titel · Status · Priorität
L (offen) Problem & Bearbeitung Beschreibung · Fälligkeit · Wiederholung
L (offen) Kontakt & Beteiligte 🔗 Beteiligte (Melder/Nachunternehmer …)
L (zu)    Verortung             Objekt · Haus · Stockwerk · Einheit · Anlage · Grundriss/Foto-Pin
L (zu)    Klassifizierung       Kategorie · Priorität · Eingangskanal · Projekt · Fehlercode
R (offen) Belege & Kommunikation Fotos · Dokumente · Chat (fester Slot)
R (zu)    Historie              Angelegt · Geändert · ID
```
*Referenz — existiert bereits (Stufe C). Wird zum core/-Standard extrahiert.*

### 6.2 Objekt (Liegenschaft) — **Seite** (Tree links)
Identität: Objektname + Adresse · Badge Aktiv/Gesperrt
```
TREE  Haus → Stockwerk → Einheit  (eigener Slot, kein Block)
L (offen) Stammdaten             Objektname · Notiz · Gesperrt
L (offen) Adresse                eingebettetes Adress-Formular (§6.5)
L (offen) Struktur 🔗            Häuser/Stockwerke/Einheiten → Liste
R (offen) Partner / Beteiligte 🔗 Eigentümer · Auftraggeber · Nachunternehmer → Liste
R (zu)    Verortung (Karte)       Geo (Vorschlag) · Kartenvorschau
R (zu)    Verknüpfte Tickets 🔗   → vorgefilterte Ticket-Liste
R (zu)    Historie               Angelegt · Geändert · ID
```

### 6.3 Geschäftspartner — **Seite** (großes Aggregat)
Identität: Firmen-/Personenname · Partner-Nr · Typ-Badges · Aktiv/Gesperrt
```
L (offen) Stammdaten             Name/Firma · Typen · Rechtsform · Branche · Übergeordneter Partner · Notiz
L (zu)    Personenangaben        Anrede · Titel · Vor-/Nachname   [nur bei Privatperson]
L (offen) Direkte Kontaktdaten   E-Mail · Telefon · Mobil · Fax · Website
L (offen) Kontaktpersonen 🔗     Name · Rollen · Kontakt · Hauptkontakt → Liste
L (offen) Adressen 🔗            eingebettete Adress-Formulare (§6.5)
R (offen) Status & Hierarchie    Gesperrt · Partner-Nr · Niederlassungen
R (zu)    Identifikatoren        USt-IdNr · Steuernr · HRB
R (zu)    Verknüpft 🔗           Objekte · Projekte · Tickets · Dokumente → je Liste
R (zu)    Historie               Erstellt · Geändert · ID
```

### 6.4 Projekt — **Panel**
Identität: Projektname · Projekttyp-Badge · Status-Badge
```
L (offen) Stammdaten             Projektname · Beschreibung
L (offen) Objekte 🔗             → Objekt-Liste
L (offen) Tickets im Projekt 🔗  → vorgefilterte Ticket-Liste
L (zu)    Notizen                Notiz
R (offen) Klassifizierung        Projekttyp · Status
R (offen) Verantwortung & Termine Verantwortlich · Start · Ende
R (zu)    Historie               Ticket-Anzahl · Erstellt · Geändert · ID
```

### 6.5 Adresse — **Panel, bewusst schlank** *(Tim: „nur die Anschrift")*
Identität: einzeilige Anschrift
```
L (offen) Anschrift             Straße · Hausnr · Zusatz · PLZ · Ort · Land · Bemerkung
R (zu)    Historie              Angelegt · Geändert · ID
```
**Kernregel:** Adresse ist primär ein **wiederverwendbares Inline-Formular-Feld** — einbettbar in Objekt,
Partner, Ticket. Speicherung/Wiederverwendung im Backend. **Keine Dubletten-Prüfung hier** (gehört —
später — zum Geschäftspartner; jetzt **nicht** geöffnet). Geo nur als spätere Option.

### 6.6 Anlage — **Panel**
Identität: Bezeichnung + Icon · Kategorie-Badge · Aktiv
```
L (offen) Stammdaten            Bezeichnung · Kategorie · Icon · Beschreibung
L (offen) Standort              Objekt · Stockwerk
L (offen) Offene Tickets 🔗     → vorgefilterte Ticket-Liste
L (zu)    Bekannte Fehlercodes 🔗 → Fehlercode-Liste
R (offen) Status & Anzeige      Aktiv · Reihenfolge
R (zu)    Historie              Erstellt · Geändert · ID
```

### 6.7 Fehlercode — **Panel**
Identität: Code (Mono-Badge) + Titel · Quelle-Badge · Aktiv
```
L (offen) Stammdaten                Code · Titel · Beschreibung
L (offen) Lösung (nur Fachpersonal)  Lösungshinweis · Sichtbar-für-Rollen   ⚠ rollenabhängig (Frau-Zwittich)
R (offen) Klassifizierung & Vorbelegung Kategorie · Std-Priorität · Std-Tickettyp · zugeordnete Anlage
R (offen) Herkunft & Status         Quelle · Aktiv
R (zu)    Verwendung in Tickets 🔗  → vorgefilterte Ticket-Liste
R (zu)    Historie                  Erstellt · Geändert · ID
```

---

## 7. Abnahmekriterien

### 7.1 Global — gilt für JEDES migrierte/neue Modul (Pflicht-Checkliste)
- [ ] Liste über `PowerListenView` mit **allen** Funktionen aus §5.1.
- [ ] Seite mit `PageShell` (richtige Variante) + `PageHeader` (Standard-Größe).
- [ ] Detail = **zentriertes Overlay** über sichtbarer Liste; Esc/✕ → Liste.
- [ ] Detail via **Block-Engine**: Regionen links/rechts, progressive Offenlegung (häufig offen, selten zu).
- [ ] **Sprung-Chips** vorhanden (Feld=scroll, Verknüpfung=Liste); **jeder Block hat stabilen `blockKey`, jeder Chip referenziert genau einen `blockKey`/`activeKey`**.
- [ ] **Chip-Klick gibt sichtbares Feedback** (Block auf + Flash + Aktiv-Chip) — **auch wenn 0 px gescrollt wird**. Detail-Body in `DetailNavProvider` + `DetailScroll` gewickelt.
- [ ] **Verknüpfungs-Vorschauzeilen klickbar** (`onItemClick` → Ziel-Detail); Block-Köpfe mit Hover.
- [ ] **Verknüpfungen** öffnen Ebene-3-`PowerListenView` (vorgefiltert, volle Funktionen) — keine Eigenbau-Liste.
- [ ] **„Historie"-Block** vorhanden (Angelegt/Geändert/ID), zugeklappt.
- [ ] **Mobil**: einspaltig, große Touch-Ziele, kein horizontaler Tab-Stress.
- [ ] **Panel-vs-Seite** nach §5.3 korrekt gewählt.
- [ ] **Keine neuen Felder** ohne Freigabe (real vs. (Vorschlag) sauber getrennt).
- [ ] Smoke-Test je Seite (gespeicherte Ansichten/Spalten-State bricht nicht — Memory `tanstack-grouping-loop`).

### 7.2 Pro Modul
Das Soll-Block-Layout entspricht der Skizze in §6 (Blöcke · Region · Default-Aufklappzustand · Verknüpfungen).
Abweichungen nur mit Tim abgestimmt + hier nachgezogen.

---

## 8. Verbindlichkeit & Verankerung

1. **Skill `modul-standard`** (`.claude/skills/modul-standard/SKILL.md`): liefert vor jedem Modul-/Listen-Bau
   die Bau-Vorlage + die Abnahme-Checkliste (§7.1). **Bei neuem/geändertem Modul ist der Skill zu nutzen.**
2. **CLAUDE.md §4** verweist auf dieses Dokument als **den** Modul-Standard (statt nur Listen-Konvention).
3. **Bestehende Module** werden schrittweise migriert (s. §9); neue Module starten sofort auf dem Standard.

## 9. Umsetzungsschnitt (Slices)

1. **Slice 1 — Fundament + Referenz:** `core/`-Bausteine (`PageShell`/`PageHeader`/`ViewModeToggle`/
   `useListenState`/`DetailOverlay`) + **Block-Engine aus `fm-tickets/` nach `core/detail/` generalisieren** +
   **`RelationList`** (Ebene-3-Liste). **Ein Referenz-Modul** komplett darauf (Vorschlag: **Projekt** — klein,
   beweist Block-Engine + verknüpfte Liste) → **Tim-Abnahme**.
2. **Slice 2 — Power-Defaults zentral:** Density/Sticky/Kebab/Consolidated-Settings als Engine-Default
   scharf schalten (der nie vollzogene W2-Roll-out), je Seite smoke-getestet.
3. **Slice 3 — Engine-Listen migrieren:** Objekte, Partner, Adressen, Anlagen, Fehlercodes, Benutzer,
   Dokumente, Tickets auf Shell+Header+useListenState (mechanisch, je Seite ein Commit).
4. **Slice 4 — Detail-Engine ausrollen:** Objekt/Partner/Anlage/Fehlercode-Details auf die Block-Engine
   (je nach Skizze §6), Verknüpfungen als Ebene-3-Listen.
5. **Slice 5 — Eigenbau-Seiten harmonisieren:** Vorlagen/Wartungen/MeineTickets auf Engine bzw. Shell;
   Auswahllisten/Status-Workflow/Dashboard/Kanban nur PageShell+PageHeader.
6. **Slice 6 — Konvention dokumentieren** (docs/patterns/) + CLAUDE.md §4 als erfüllt markieren.

## 10. Offene Mini-Punkte
- Adresse-Inline-Formular: genaue Einbettungs-Stellen (Objekt/Partner/Ticket) beim Bau festlegen.
- Geo am Objekt/Adresse: (Vorschlag) — erst bauen, wenn Adress-/Geo-Thema dran ist.

---

*Konzept zuerst. Dieses Dokument ist die verbindliche Referenz; Abweichungen brauchen Tims Freigabe + ein Update hier.*
