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
   (Liste bleibt sichtbar). Im Detail wechselt man über **Reiter (Tabs)** zwischen „Übersicht" und den
   Verknüpfungs-Listen — **inline im selben Overlay** (§5.2/5.4/5.5), nicht als gestapeltes Fenster.
3. **Progressive Offenlegung.** Beim Öffnen ist nur das Wichtige offen, Seltenes/Kontext/Historie
   zugeklappt → bleibt schlank, egal wie viele Felder dazukommen.
4. **Verknüpfungen sind echte Listen, keine Spielzeug-Listen.** Jede n:m-/1:n-Beziehung (z. B.
   „verknüpfte Tickets") ist ein **Reiter mit der vollwertigen** `PowerListenView` (alle Funktionen,
   vorgefiltert), **lazy** geladen.
5. **Keine erfundenen Felder.** Es wird nur gebaut, was im Datenmodell existiert. Vorschläge für neue
   Felder werden im Konzept als **(Vorschlag)** markiert und brauchen Tims Freigabe.

## 3. Das Schichten-Modell

```
   Ebene 1: MODUL-LISTE  (Basis — PowerListenView, volle Funktionen)
        │  Klick auf Zeile
        ▼
   Ebene 2: DATENSATZ-DETAIL  (zentriertes Overlay über der Liste)
        │  Reiter-Leiste: [Übersicht] [Objekte] [Tickets] …
        │  Reiter „Übersicht" = Block-Engine (Felder)
        │  Verknüpfungs-Reiter = vorgefilterte PowerListenView INLINE (lazy)
        │  Klick auf Listenzeile → Detail dieses Datensatzes …
        ▼
   (rekursiv weiter)        ✕ / Esc schließt das Overlay
```

## 4. Bausteine (alle in `apps/web/src/core/` — FM-frei, Plattform-Anker-konform)

| Baustein | Zweck |
|---|---|
| `PageShell` | Seiten-Wrapper, 2 Varianten: `list` (volle Breite) · `form` (zentriert max-w-5xl, für Konfig-Editoren) |
| `PageHeader` | Titel/Untertitel + Aktionen-Slot — **ein** Größen-Standard |
| `PowerListenView` | **existiert** — bleibt die einzige Listen-Engine (s. §5.1) |
| `useListenState` | kapselt ViewConfig/Default + Handler + Persistenz (entfernt das 9-fach-Boilerplate) |
| `DetailOverlay` | zentriertes Overlay über der Liste (Backdrop, Esc/✕, max-h 92vh); Breite: `panel`≈max-w-3xl · `page`≈max-w-6xl |
| `DetailTabs` | **Reiter-Leiste + Panel** (§5.2): „Übersicht" + Feld-/Verknüpfungs-Reiter; rendert nur den aktiven Reiter (leichtes DOM), a11y-Rollen, mobil scrollbar |
| `BlockEngine` | **generalisiert aus der Stufe-C `TicketFormEngine`** — rendert Regionen→Blöcke→Felder aus Katalog+Layout, Renderer-Registry je Feld; Auffang-Block „Weitere" |
| `RelationListView` | Verknüpfungs-**Reiter**: vorgefilterte Liste (`PowerListenView`-Funktionsumfang) + Suche, **inline**, lazy. (Optional `RelationList`-Vorschau, falls eine Beziehung als Block in „Übersicht" gezeigt wird.) |
| `DetailNavProvider`/`DetailScroll` | optionaler **In-Reiter-Sprung** (Chips + Flash + Scroll-Spy) für einen einzelnen sehr langen Reiter |

## 5. Verbindliche Regeln

### 5.1 Liste (Ebene 1) — Pflicht-Funktionsumfang
Jede Modul-Liste MUSS über `PowerListenView` laufen und folgende Funktionen haben (CLAUDE.md §4 +
Power-Layout): **Volltextsuche · Spaltenfilter (Typ passend zum Feld) · Sortierung (Multi via Shift,
3-Klick-Reset) · Gruppierung (↑↓-Pills) · gespeicherte Ansichten · Bulk-Auswahl-Spalte · Spalten
ein/ausblenden (SPALTEN_DEFINITION) · Treffer-Zähler (gefiltert/gesamt) · Power-Layout (Drag-Reorder)**.
**Keine Kachel-/Karten-Ansicht — ausschließlich Listen (Tim 2026-06-02).** Kein ViewModeToggle.

### 5.2 Detail (Ebene 2) — Aufbau — **Reiter-Modell** (verbindlich ab 2026-06-02, Tim-Entscheidung)

> **Wechsel zum Reiter-Modell (Tim, 2026-06-02):** Die Sprung-Chips (nur Scroll/Highlight) wurden als
> „überflüssig, sobald der Bereich eh sichtbar ist" empfunden. Stattdessen sind die obersten Bereiche
> jetzt **echte Reiter (Tabs)**, zwischen denen man umschaltet — einheitlich, mobil-tauglich, skaliert
> mit dem Wachstum. Das ersetzt die alte Regel „keine Tabs" (§5.4 neu).

- Öffnet als **zentriertes Overlay** über der sichtbaren Liste. ✕ / Esc → zurück zur Liste.
- **Kopf:** Identität (Name/Nummer + Status-Badges) + Aktion „schließen".
- **Reiter-Leiste** unter dem Kopf, **immer sichtbar**. Klick auf einen Reiter **schaltet den Inhalt um**
  (eigene „Maske" in derselben Overlay-Fläche), aktiver Reiter ist markiert. Mobil: horizontal scrollbar
  (durchtippen). Mechanik einmal in `core/detail` (`DetailTabs`), Module liefern nur die Reiter-Definition.
- **Reiter-Arten:**
  1. **„Übersicht"** (immer erster Reiter): die Kernfelder als Block-Sektionen in **zwei Regionen**
     (links primär 3/5, rechts Kontext 2/5; mobil einspaltig), Accordions mit progressiver Offenlegung
     (häufig offen, selten/Historie zu). **„Historie"** bleibt hier ein zugeklappter Block.
  2. **Feld-Reiter** für eine Kategorie **nur, wenn sie groß genug ist** (Tim 2026-06-02). Dünne
     Kategorien bleiben in „Übersicht" bzw. werden ausgeblendet — **kein** Zerschneiden des Formulars in
     viele Mini-Reiter.
  3. **Verknüpfungs-/Chat-Reiter** (Objekte, Tickets, Dokumente, Chat …): volle, vorgefilterte Liste
     **inline** (§5.5).
- **Lazy + leichtes DOM (verbindlich):** Nur der **aktive** Reiter ist gemountet; ein Verknüpfungs-Reiter
  lädt seine Daten **erst beim ersten Öffnen** (React-Query gecached, Re-Open sofort). Zähler am Reiter
  kommen aus dem Datensatz (z. B. `ticket_count`), ohne die Liste vorab zu laden.
- **Optionaler In-Reiter-Sprung:** Für einen **einzelnen, sehr langen** Reiter (z. B. eine riesige
  „Übersicht") können die Sprung-Chips aus `core/detail` (`DetailNavProvider`/`DetailScroll`:
  Aufklappen + Flash + Scroll-Spy `aria-current`) **innerhalb** des Reiters genutzt werden. Das ist
  ein Hilfsmittel im Reiter, nicht die Top-Navigation.
- **Klickbarkeit:** Verknüpfungs-Listenzeilen sind **klickbar** (`onItemClick` → Ziel-Detail), Block-Köpfe
  haben flächigen Hover. Read-only-Felder (bis Inline-Editing live ist) zeigen dezenten Border-Hover +
  `title="Bearbeiten folgt"` — **kein** Cursor-pointer/Stift, der „jetzt editierbar" verspricht.

### 5.3 Panel vs. eigene Seite (= Overlay-Breite)
**Eine Frage:** „Hat der Datensatz eine eigene Navigations-/Hierarchie-Innenwelt?"
- **Nein** → **Panel** (schmaleres zentriertes Overlay). Default. → Ticket, Projekt, Adresse, Anlage, Fehlercode, Benutzer.
- **Ja** (Baum / viele Beziehungs-Listen) → **Seite** (breites Overlay, ggf. mit Tree links). → Objekt, Geschäftspartner.
- **Beide rendern denselben Block-Engine-Inhalt** — der Unterschied ist nur die Breite + ggf. ein Tree-Slot.

### 5.4 Reiter (Tabs) vs. Sektion — **neu (Tim 2026-06-02)**
- **Reiter (Tabs) sind das Top-Level-Navigationsmuster** des Details: „Übersicht" + eigene Reiter für
  **große** Feld-Kategorien + **Verknüpfungs-/Chat-Reiter**. Immer alle oben sichtbar, Wechsel = klicken.
  Begründung: einheitlich (Felder wie Verknüpfungen gleich erreichbar), mobil-tauglich, skaliert mit Wachstum.
- **Innerhalb** der „Übersicht" bleiben **scrollende Block-Sektionen** (Accordion). Ein Formular wird
  **nicht** in viele Mini-Reiter zerschnitten — eine Kategorie wird **erst dann** ein eigener Reiter, wenn
  sie für sich genommen groß/eigenständig genug ist; sonst bleibt sie in „Übersicht" oder ausgeblendet.

### 5.5 Verknüpfungen — **Inline-Reiter (neu)**
Jede n:m-/1:n-Beziehung (Objekte, Tickets, Dokumente …) ist ein **eigener Reiter** mit der **vollwertigen,
vorgefilterten Liste** (`PowerListenView`-Funktionsumfang §5.1) **inline im selben Overlay** — kein
gestapeltes Fenster, kein „zurück zum Detail" (man wechselt über die oben sichtbaren Reiter). Skaliert auf
beliebig viele Beziehungen. **Performance** ist dabei **kein** Argument gegen „inline": Reiter vs. Fenster
rendern dieselbe Liste — die Last hängt allein an der **Lade-Strategie** (§5.2 Lazy: nur aktiver Reiter
gemountet, Daten erst beim Öffnen, server-/seitenweises Laden, Virtualisierung nur falls je nötig). Verknüpfungen
sind zudem auf den Datensatz **vorgefiltert** (= naturgemäß kleine Teilmenge).

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

### 6.4 Projekt — **Panel** · Reiter: **[Übersicht] [Objekte·N] [Tickets·N]**
Identität: Projektname · Projekttyp-Badge · Status-Badge
```
Reiter „Übersicht" (zwei Regionen):
  L (offen) Stammdaten             Projektname · Beschreibung
  L (zu)    Notizen                Notiz
  R (offen) Klassifizierung        Projekttyp · Status
  R (offen) Verantwortung & Termine Verantwortlich · Start · Ende
  R (zu)    Historie               Ticket-Anzahl · Erstellt · Geändert · ID
Reiter „Objekte" 🔗   → vorgefilterte Objekt-Liste, inline, lazy (Zähler aus objekte.length)
Reiter „Tickets" 🔗   → vorgefilterte Ticket-Liste, inline, lazy (Zähler aus ticket_count)
```
(Keine eigenen Feld-Reiter für Klassifizierung/Termine — zu dünn, bleiben in „Übersicht"; §5.2/2.)

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
- [ ] **Reiter-Leiste** (`DetailTabs`) oben, immer sichtbar: **„Übersicht"** + eigene Reiter nur für große Feld-Kategorien + **Verknüpfungs-/Chat-Reiter**. Aktiver Reiter markiert, Klick schaltet um.
- [ ] **„Übersicht"** via **Block-Engine**: Regionen links/rechts, progressive Offenlegung (häufig offen, selten zu), inkl. zugeklapptem **„Historie"**-Block (Angelegt/Geändert/ID).
- [ ] **Verknüpfungen = Inline-Reiter** mit voller, vorgefilterter Liste (`PowerListenView`-Funktionsumfang) + Suche — **kein** gestapeltes Fenster, **kein** „zurück". Listenzeilen klickbar (`onItemClick` → Ziel-Detail).
- [ ] **Lazy:** nur aktiver Reiter gemountet; Verknüpfungs-Reiter lädt erst beim Öffnen; Reiter-Zähler aus dem Datensatz (nicht die ganze Liste vorab laden).
- [ ] **Mobil**: Reiter-Leiste horizontal scrollbar, „Übersicht" einspaltig, große Touch-Ziele.
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
