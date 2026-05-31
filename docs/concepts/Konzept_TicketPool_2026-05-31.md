# Konzept: Der Ticket-Pool — das Ticket als Herzstück

> **Projekt:** fm-stoerungen-app (08_FM_ERP_app)
> **Stand:** 2026-05-31 (v2)
> **Status:** **Konzept freigegeben** (Tim, 2026-05-31). Scope: **das Ticket selbst** (Felder, Inhalte,
> Aufbau, Logiken, Verknüpfungen, Foto) · **Nordstern + Stufe-1-Schnitt** · **KI nur als Hook-Punkte**
> (Detail in `ki-first.md`). **Kernentscheidung:** Das Ticket ist **vorlagengetrieben** — voller
> Vorlagen-Designer schon in Stufe 1. Umsetzungsschnitt folgt **separat**.
> **Autor:** Claude (Konzeptphase)
> **Bezug:** [plan.md](../plan.md) §5.1/5.2/5.6/5.7/5.8/5.10/5.13 · [ki-first.md](ki-first.md) ·
> [berechtigung-und-ebo-vorlagen.md](berechtigung-und-ebo-vorlagen.md) · CLAUDE.md §4 (Listen-Konvention)

---

## 1. Ziel & Auslöser

Das **Ticket** ist das Herzstück der FM-Software — alles andere (Stammdaten, Dashboards, Listen)
dient ihm zu. Die Listen-/Pool-Ansicht drumherum ist bereits reif. Das **Ticket-Objekt selbst** ist
datenmodell-seitig schon sehr reich, hat aber Lücken gegenüber der Zielvision — und vor allem fehlt
das tragende Prinzip im UI: **das Ticket entsteht aus einer Vorlage.**

Dieses Konzept schreibt **das Ticket als Entität** autoritativ fest: wie es aus einer Vorlage
aufgebaut wird, welche Felder es trägt, wie sie sich verhalten und verknüpfen, wie das Erfassen sich
vom Bearbeiten unterscheidet, und wo Foto, E-Mail und die KI-Andockpunkte sitzen. Es zeichnet das
**Zielbild (Nordstern)** und markiert klar den **Stufe-1-Schnitt** (Pilot bei Joachim Löffler).

---

## 2. Leitprinzipien für das Ticket

1. **Vorlagengetrieben.** Ein Ticket entsteht **immer aus einer Vorlage** (per ID gewählt). Die
   Vorlage bestimmt, welche Felder erscheinen, welche Pflicht sind, in welcher Reihenfolge. Der
   **Vorlagen-Designer ist die einzige Wahrheit** (Single Source of Truth) für den Ticket-Aufbau.
2. **Kern zuerst.** Nur ein **kleiner Satz Kernfelder (Titel, Status)** ist in jeder Vorlage fix
   gesetzt; alles Weitere — **inkl. Priorität und Objekt** — ist frei zuschaltbar (kein Mammut-Formular).
3. **Eingang ≠ Bearbeitung.** Das Ticket hat zwei Gesichter: geführtes **Erfassen** und fokussiertes
   **Fortschreiben**. Quellen sind sauber vom Workflow getrennt (web/mieter/ebo docken später an).
4. **Konfigurierbar statt hartcodiert.** Vorlagen, Status, Priorität, Kategorie, Quelle,
   Wartet-Gründe, Status-Übergänge — alles liegt in Stammdaten/Auswahllisten, nicht im Code.
5. **Mobile gleichwertig.** Techniker am Handy, mit Handschuhen — große Touch-Targets,
   **Kamera-Direktzugriff**, wenig Text.
6. **Ein zentrales, schönes Ticket.** Eine API-first Ticket-UI, einmal maximal userfreundlich
   gestaltet, überall gleich genutzt (Web/Mobile, später Portal).
7. **KI-ready, Frau-Zwittich-konform.** KI nur als reservierte Andockpunkte; **Techniker bekommen
   keine fertigen Lösungshinweise**.
8. **Audit ≠ Konversation.** Maschinen-Verlauf im Backend; sichtbar im UI nur der **Chat**.

---

## 3. Das vorlagengetriebene Ticket & der Vorlagen-Designer

**Das Grundthema des Tickets.** Ein Ticket existiert nie „leer". Beim Anlegen wählt der User eine
**Vorlage** → die Vorlage „baut" das Ticket: welche Felder sichtbar sind, welche Pflicht, in welcher
Reihenfolge, mit welchen Defaults und welcher Listen-Sicht.

**Feld-Katalog-Regel (verbindlich für die künftige Programmierung):** Es gibt einen **zentralen
Katalog aller Ticket-Felder** (= das Feld-Inventar aus §5). Der Designer kann nur Felder aus diesem
Katalog anordnen; umgekehrt muss **jedes neu programmierte Ticket-Feld in den Katalog aufgenommen
werden**, damit es im Designer wählbar ist. So bleiben Datenmodell und Designer dauerhaft synchron.

**Stufe-1-Umfang (Tim-Entscheidung 2026-05-31): voller Self-Service-Designer.** Der Admin kann
Vorlagen **selbst anlegen und bearbeiten**: Felder ein/aus, Pflicht ja/nein, Reihenfolge,
Bezeichnung/Icon, eigene Listen-Sicht. Ausgeliefert mit **drei Start-Vorlagen** (Reparatur, Wartung,
Baubegehung), die der Admin anpassen oder ergänzen kann.

> **Abweichung zu plan.md:** plan.md führte den vollen Vorlagen-Designer als Stufe-2-Feature
> (Stufe 1 = drei feste Typen). Auf Tims Entscheidung wird der **Designer in Stufe 1 vorgezogen**.
> Die technische Basis ist da: `tickettyp` + `TickettypFeld` (Sichtbarkeit/Pflicht/Reihenfolge je
> Feld) sind bereits verdrahtet — der Designer ist die Admin-UI darüber.

**Vorlage-Wechsel am bestehenden Ticket (Tim-Entscheidung #9):** erlaubt. Beim Wechsel werden die
Felder der neuen Vorlage geladen. Felder, die die neue Vorlage **nicht** führt, werden — nach einem
**Bestätigungsdialog, der sie auflistet** — **geleert (genullt)**, damit spätere Auswertungen sauber
bleiben (ein Feldwert existiert nur, wenn die Vorlage das Feld führt; keine verdeckten „Orphan"-Werte).
Der **Audit-Log hält den alten Wert** fest. Pflichtfelder der neuen Vorlage werden beim Speichern angemahnt.

---

## 4. Zwei Gesichter: Eingang (Anlegen) ≠ Bearbeitung (Detail)

| | **Eingang — Anlege-Modal** | **Bearbeitung — Detail-Panel** |
|---|---|---|
| Zweck | geführtes, vollständiges Erfassen | fokussiertes Fortschreiben |
| Aufbau | **Vorlage wählen** → Felder laden; Objekt-Kaskade; Pin setzen; Triage-Slot | Status, Wartet-auf, Foto, Dokumente, Chat, Zuweisung |
| Quelle Stufe 1 | `manuell`, `telefon` | — |
| Quelle Nordstern | `web`, `mieter`, `ebo`, E-Mail-Drag&Drop, KI-Triage | — |

**Klarstellung (Tim #9):** Im offenen Ticket ist **alles editierbar — inkl. Vorlage wechselbar**.
„Eingang ≠ Bearbeitung" meint also **Führung/Flow**, nicht eingeschränktes Editier-Recht.

---

## 5. Anatomie des Tickets (Feld-Inventar = Designer-Katalog)

Legende — **P?**: Pflicht (vorlagengesteuert) · **wo**: E=Eingang, D=Detail · **S**: Stufe ·
**Vorlage**: im Designer zuschaltbar (▣) oder Kernfeld/immer (●).

### 5.1 Identität & Herkunft
| Feld | Typ | P? | wo | S | Vorlage | Logik |
|---|---|:--:|:--:|:--:|:--:|---|
| `nummer` | int (`T-xxxx`) | auto | – | 1 | ● | fortlaufend je Mandant |
| `titel` | string(200) | ✅ | E·D | 1 | ● | Kernfeld; Schreibassistenz-Slot |
| `beschreibung` | text | vorlage | E·D | 1 | ▣ | Schreibassistenz-Slot |
| `quelle` | FK Auswahlliste | vorlage | E | 1 | ▣ | telefon/manuell (S1), web/mieter/ebo (Nordstern) |
| `melder` | string(200) | vorlage | E | 1 | ▣ | wer gemeldet hat |
| `eroeffnet_von` / `eroeffnet_am` | FK user / datetime | auto | – | 1 | ● | aktueller User + Zeit |

### 5.2 Klassifizierung
| Feld | Typ | P? | wo | S | Vorlage | Logik |
|---|---|:--:|:--:|:--:|:--:|---|
| `status` | FK Auswahlliste | ● (default `neu`) | E·D | 1 | ● | 5 Werte + Hook (§6.2) — **nicht abwählbar** |
| `prioritaet` | FK Auswahlliste | vorlage (default mittel) | E·D | 1 | ▣ | P1–P4; **abwählbar** (Tim) |
| `kategorie` | FK Auswahlliste | vorlage | E·D | 1 | ▣ | konfigurierbar; **im Detail schreibbar machen** |

### 5.3 Verortung (Objektstruktur, 4-stufig)
| Feld | Typ | P? | wo | S | Vorlage | Logik |
|---|---|:--:|:--:|:--:|:--:|---|
| `objekt_id` | FK | vorlage (optional) | E·D | 1 | ▣ | Liegenschaft; **optional/abwählbar** (Tim) |
| `haus_id` | FK | dyn. | E·D | 1 | ▣ | nur bei Mehrhaus-Objekt |
| `stockwerk_id` | FK | dyn. | E·D | 1 | ▣ | trägt Grundriss |
| `einheit_id` | FK | dyn. | E·D | 1 | ▣ | nur wenn Einheiten vorhanden |
| `pin_x` / `pin_y` | decimal % | – | E setzen / D zeigen | 1 | ▣ | Pin auf Grundriss (§8.3) |
| `anlage_id` | FK | vorlage | E·D | 1 | ▣ | technische Anlage (RLT/Heizkreis) |

### 5.4 Zuordnung
| Feld | Typ | P? | wo | S | Vorlage | Logik |
|---|---|:--:|:--:|:--:|:--:|---|
| `tickettyp_id` (= Vorlage) | FK Tickettyp | ● | E·D | 1 | ● | **steuert das Feld-Set**; wechselbar (§3) |
| `partner_id` | FK Partner | vorlage | E·D | 1 | ▣ | meldender Mieter/Auftraggeber |
| `projekt_id` | FK Projekt | vorlage | E·D | 1 | ▣ | Sammelposten |
| `fehlercode_id` | FK Fehlercode | vorlage | E | 1/2 | ▣ | S1: Beschreibung-Vorbefüllung; Voll-Mapping = Stufe 2 (§6.4) |
| `zugewiesen_an_id` / `zugewiesen_am` | FK user / datetime | – / auto | D | 1 | ▣ | Techniker; Auto-Status |

### 5.5 Status-Zeitstempel
| Feld | Typ | wo | S | Logik |
|---|---|:--:|:--:|---|
| `erledigt_am` | datetime | auto | 1 | gesetzt bei Status→erledigt |
| `geschlossen_am` | datetime | – | **geparkt** | zurückgestellt (Tim #2) |
| `deleted_at` | datetime | – | 1 | Soft-Delete |

### 5.6 Wartet-auf (Blockaden sichtbar machen, plan §5.7)
| Feld | Typ | P? | wo | S | Logik |
|---|---|:--:|:--:|:--:|---|
| `wartet_grund` | FK Auswahlliste | ✅ wenn Status-Hook aktiv | D | 1 | material/mieter/freigabe/extern |
| `wartet_nachunternehmer_id` | FK Partner | ✅ wenn grund=`extern` | D | 1 | konkreter Nachunternehmer |
| `wartet_kontakt_name/telefon/email` | string | auto, überschreibbar | D | 1 | aus Stamm vorbefüllt |

### 5.7 Termine & Wiederholung
| Feld | Typ | P? | wo | S | Vorlage | Logik |
|---|---|:--:|:--:|:--:|:--:|---|
| `faelligkeit_am` | date | vorlage | E·D | 1 | ▣ | **als Feld sichtbar machen**; per Vorlage aktivierbar (nicht nur Wartung); Reminder N Tage vorher |
| `wiederholung` | string(32) | vorlage | E·D | 1 | ▣ | einmalig/jährlich/halbjährlich/quartal |

### 5.8 Anhänge
| Anhang | Modell | wo | S | Logik |
|---|---|:--:|:--:|---|
| **Fotos** | TicketPhoto (1:n) | D | 1 | Galerie + SVG-Annotation + **Kamera** (§8.2) |
| **Dokumente** | DokumentLink (n:m) | D | 1 | **UI am Ticket anbinden** (Tim #6) |

### 5.9 Kommunikation & Historie
| Element | Modell | Sichtbar? | S | Logik |
|---|---|:--:|:--:|---|
| **Chat** | TicketMessage + @-Mentions | ja | 1 | Bubbles; **Read-Receipts** ergänzen |
| **Audit-Verlauf** | Backend-Log | nein (UI) | 1 | nur Backend; UI-Report = Nordstern |
| **Notifications** | notification | Bell/Toast/Push | 1 | bei Mention/Zuweisung/Status |

### 5.10 KI-Slots (nur Hook-Punkte — Detail in ki-first.md)
| Slot | Sichtbarkeit | S | Notiz |
|---|---|:--:|---|
| Triage-Vorschlag | Eingang | Nordstern | unstrukturiert → Ticket-Vorschlag |
| Auto-Klassifizierung | alle, mit Confidence | Nordstern | Kategorie/Prio/Vorlage im Hintergrund |
| Ähnliche-Tickets-Panel | **Admin/Büro-only** | Nordstern | braucht `embedding_vec` (kommt mit KI, Stufe 2) |
| Schreibassistenz | Beschreibung/Chat | Nordstern | Formulierhilfe |

> **`embedding_vec` (Tim #7):** wird **erst mit der KI in Stufe 2** angelegt, nicht jetzt. In Stufe 1
> nur die UI-Slots reserviert (leer, „kommt mit KI").

---

## 6. Querschnitt-Logiken

### 6.1 Status-Übergangs-Matrix — frei definierbar in Stammdaten (Tim #1)
Die erlaubten Übergänge sind **keine Code-Konstante**, sondern eine **frei einstellbare Kombinatorik
in den Stammdaten** (Admin pflegt „von-Status → erlaubte Ziel-Status"). Stufe 1 liefert eine sinnvolle
Default-Matrix mit; Anzeige im Detail als **Workflow-Buttons** (nur erlaubte Übergänge sichtbar),
nicht als Dropdown (plan §5.1).

Default (anpassbar): `neu→{prüfung,bearbeitung,wartet,erledigt}`, `prüfung→{neu,bearbeitung,wartet,erledigt}`,
`bearbeitung→{prüfung,wartet,erledigt}`, `wartet→{bearbeitung,erledigt}`, `erledigt→{bearbeitung}` (Re-Open nur Admin).
Auto-Logik (umgesetzt): Zuweisung aus `neu` → `bearbeitung`; Status→`erledigt` setzt `erledigt_am`.

### 6.2 Status-Hook „wartet auf" (Tim)
Ein Status-Wert in der Auswahlliste trägt einen **Hook/Flag** (z. B. `erfordert_grund`). Ist er aktiv
(„wartet auf" = true), erscheint im Ticket der **Sub-Grund-Picker** (und je nach Grund die
Nachunternehmer-Felder) — genau wie im Mockup. Konfigurierbar am Status-Wert, nicht hartcodiert.

### 6.3 Vorlage steuert das Feld-Set (§3)
Sichtbarkeit, Pflicht, Reihenfolge je Feld kommen aus der Vorlage (`TickettypFeld`). Pflichtfelder
werden **aus der Vorlage vererbt** (Tim #3) — keine zweite Wahrheit im Code.

### 6.4 Fehlercode (Tim #4 → Stufe 2)
Stufe 1: einfache **Beschreibung-Vorbefüllung** bei Auswahl (wie heute). Die **Voll-Mapping-Tabelle**
(Fehlercodes hinterlegen → Kategorie/Prio/Vorlage/Anlage automatisch mappen/befüllen) wird in
**Phase 2** gebaut. Der Lösungstext wird **nie** ins Ticket gespiegelt (Frau-Zwittich).

### 6.5 Wartet-Pflichtlogik
`status`-Hook aktiv → Sub-Grund Pflicht; Grund `extern` → Nachunternehmer Pflicht. Vorschlag:
serverseitig erzwingen.

### 6.6 Dynamische Sichtbarkeit
Haus nur bei Mehrhaus, Einheit nur bei vorhandenen Einheiten, Grundriss-Pin nur bei Grundriss
(umgesetzt im Anlegen, ins Detail übernehmen).

### 6.7 Audit / Konversation / Verlauf
Audit = Backend-only (append-only); Chat = einzige sichtbare Spur; Mini-„Verlauf" (3 Timestamps)
bleibt bewusst klein; echte Audit-View = Nordstern.

---

## 7. Verknüpfungen / Beziehungsmodell

```
                         Auswahllisten (status[+Hook], prio, kategorie, quelle, wartet_grund)
                                              │
   Vorlage/Tickettyp ──baut Ticket──▶        │
   Fehlercode ──(S1) Beschreibung──▶     ┌───────────┐   ◀──n:1── Projekt (Sammelposten)
   Objektstruktur (Objekt▶Haus▶           │  TICKET   │
     Stockwerk▶Einheit) + Pin ───────────▶│ (Herzstück)│──1:n──▶ TicketPhoto (Foto + Annotation)
   Anlage (RLT/Heizung) ─────────────────▶│           │──n:m──▶ Dokument
   Geschäftspartner (Melder /             └───────────┘──1:n──▶ TicketMessage (Chat + @-Mentions)
     Wartet-Nachunternehmer) ────────────▶     │
                                                └──▶ Notification (Mention/Zuweisung/Status)
```
Delete-Verhalten: Mandant **RESTRICT**, Objekt/Partner/Anlage **SET NULL**, Foto/Chat **CASCADE**.

---

## 8. Das Ticket-Detail-Panel (UX-Zielbild)

Rechts einschwebendes, **zentral & schön gestaltetes** Slide-in. Aufbau: Kopf (`#nummer` + Prio) ·
Vorlage/Projekt-Pills · Titel · Erfasst-Zeile (Quelle/Melder) · **Wartet-Bar** (bei aktivem Hook) ·
Status/Priorität/Kategorie · Stammdaten (Ort/Partner/Fälligkeit) · Beschreibung · Zugewiesen-an ·
**Fotos** · **Dokumente** · **Chat** · Verlauf.

**Zielbild-Korrekturen:**
- **Status als Workflow-Buttons** (nur erlaubte Übergänge, §6.1).
- **Alles editierbar** (Kategorie, Ort-Kaskade, …), **Vorlage wechselbar** (§3, Tim #9).
- **Grundriss-Pin-Anzeige**; Pins offener Tickets je Stockwerk farblich nach Prio.
- **Dokument-Sektion** (n:m) analog der Foto-Galerie.
- **Read-Receipts** dezent unter Chat-Bubbles.

### 8.2 Fotofunktion
Multi-Foto-Galerie (typ. 1–2/Ticket). **Annotation im Browser:** Markier-Kreis (rot/gelb/grün) +
Text-Stempel (Defekt/Prüfen/OK) als SVG-Overlay, Original bleibt. **Kamera (Tim #5):** am Handy
öffnet der Foto-Button **direkt die Kamera** (sofort knipsen vor Ort); Desktop = Datei-Upload.
**Nordstern:** PNG-Flatten beim Export (annotiertes Bild an Nachunternehmer), Crop/Pfeil/Heatmap.

### 8.3 Grundriss-Pin (Tim #8 → Stufe 1)
Beim Anlegen Pin auf den Stockwerk-Grundriss **setzen** (x/y in %); im Detail **anzeigen**; je
Stockwerk alle offenen Pins farblich nach Prio **aggregieren**. PDF-Render / Einheit-Default-Pin /
Heatmap = Nordstern.

---

## 9. E-Mail am Ticket (Tim)
**Stufe 1:** Button „E-Mail an Beteiligte" per `mailto:` (TO Nachunternehmer / CC Auftraggeber /
BCC Joachim), Inhalt aus dem Ticket abgeleitet. **Phase 2:** auswählbare **E-Mail-Vorlagen/Texte**
und direkter Versand (Graph-API), `.msg`-Import.

---

## 10. Konfigurierbarkeit: Auswahllisten & Vorlagen (Tim)
Beim Ticket-Thema werden die **Auswahllisten konsequent mitgeführt/erweitert**: Status (inkl.
Hook-Flag), Wartet-Gründe, Kategorie, Priorität, Quelle — plus die **Vorlagen** und die
**Übergangs-Matrix**. Alles über Admin-UI pflegbar, nichts hartcodiert.

---

## 11. Stufe-1-Schnitt vs. Nordstern

| Bereich | Schon da ✅ | Stufe 1 (entschieden) | Nordstern (Stufe 2–3) |
|---|---|---|---|
| Vorlagen | `TickettypFeld` verdrahtet, 3 Typen | **Voller Vorlagen-Designer** + Feld-Katalog | – |
| Vorlage-Wechsel | – | am bestehenden Ticket, mit Daten-Nullung n. Bestätigung | – |
| Status-Übergänge | permissiv | **frei definierbare Matrix (Stammdaten)** + Workflow-Buttons | – |
| Status-Hook „wartet" | Sub-Bar im Detail | Hook-Flag am Status-Wert + Pille in Liste | Wartet-Ageing/SLA |
| Fehlercode | Beschreibung-Pre-Fill | bleibt einfach | **Voll-Mapping-Tabelle + Auto-Befüllung** |
| Foto | Upload + Annotation | **+ Kamera** | PNG-Flatten, Crop/Pfeil/Heatmap |
| Dokumente | Model + Link | **UI am Ticket** | Versionierung, OCR |
| Chat | @-Mentions, Polling | **+ Read-Receipts** | WebSocket, Mieter-Sicht |
| Grundriss-Pin | Feld + `has_grundriss` | **setzen + zeigen + aggregieren** | PDF, Heatmap |
| E-Mail | – | **`mailto:`-Button** | Vorlagen/Texte, Graph-API, `.msg` |
| Fälligkeitsdatum | Feld vorhanden | **sichtbar machen, per Vorlage** | – |
| `geschlossen_am` | totes Feld | **geparkt** | Admin-Abnahme-Schritt |
| KI / `embedding_vec` | nichts | nur leere UI-Slots | Spalte + KI-Logik (Triage/Klassifizierung/Ähnliche) |

---

## 12. Entscheidungen (alle festgehalten, Tim 2026-05-31)

**1. Runde:** Voller Vorlagen-Designer in Stufe 1 · Übergangs-Matrix frei definierbar in Stammdaten
(#1) · `geschlossen_am` geparkt (#2) · Pflichtfelder aus der Vorlage vererbt (#3) ·
Fehlercode-Voll-Mapping nach Stufe 2 (#4) · Kamera rein (#5) · Dokumente rein (#6) · `embedding_vec`
erst mit KI/Stufe 2 (#7) · Grundriss-Pin rein (#8) · im Ticket alles editierbar inkl. Vorlage-Wechsel (#9).

**Feinpunkte (2. Runde):**
- **A — Fixe Kernfelder:** nur **Titel + Status** sind nicht abwählbar; **Priorität und Objekt sind in
  der Vorlage abwählbar/optional**.
- **B — Vorlage-Wechsel:** nicht geführte Felder werden **nach Bestätigung geleert (genullt)** — für
  saubere Auswertungen; Audit hält den alten Wert.
- **C — Übergangs-Matrix:** Default-Werte ausliefern **+ kleine Admin-Editier-UI** in Stufe 1.
- **D — Pflichtfeld-Defaults je Start-Vorlage:** bewusst offen, **final mit Joachim** (= plan offener
  Punkt #9) — blockiert das Konzept nicht.

---

## 13. Nächste Schritte
1. ✅ Konzept freigegeben und abgelegt (dieses Dokument).
2. Offener Abstimmungspunkt **D** (Pflichtfeld-Defaults je Vorlage) mit Joachim klären.
3. Danach — **separat** — den Umsetzungsschnitt schärfen (nicht Teil dieses Konzepts).

---

*Konzept zuerst. Umsetzung folgt in separater Runde.*
