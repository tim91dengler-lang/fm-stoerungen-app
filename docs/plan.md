# Konzept: FM Störungsmanagement (Joachim Löffler / Schartec)

**Projekt:** 08_FM_ERP_app
**Stand:** 2026-05-21 (v6 — Dokumenten-Verwaltung in Stufe 1 dazu)
**Status:** Aktualisiert — ersetzt v5 vom 2026-05-21

> **Änderungen gegenüber v5:**
> - **Dokumenten-Verwaltung in Stufe 1** als eigene Stammdaten-Entität (`dokument`-Tabelle) ergänzt. Drag-and-Drop von Dateien und Outlook-E-Mails (`.msg`/`.eml`) am Ticket-Detail und im Anlegen-Modal. Eigener Stammdatenbereich „Dokumente" mit Power-Layout-Liste, n:m-Verknüpfungen zu Ticket/Projekt/Objekt/Partner. Foto-Galerie bleibt getrennt (eigenes `ticket_foto`-Schema wegen SVG-Annotation-Workflow).
> - Aufwand Stufe 1 indikativ weitere +6–8 PT (siehe Tech-Spec v0.5).
>
> **Änderungen gegenüber v4 (v5):**
> - **KI-Light in Stufe 1** verankert: API-Key-Admin-UI · LLM-Gateway produktiv · 3 Use Cases live (Schreibassistenz, Triage-Vorschlag im Anlegen-Modal, Ähnliche-Tickets-Suche als Admin-Side-Panel). Begründung: Joachim auf Pilot-Kurs, KI-Demo-Effekt in der Pilot-Phase ist Differenzierungsmerkmal vor Folge-Beauftragung.
> - **Frau-Zwittich-Regel bleibt eingebaut:** Ähnliche-Tickets-Suche und Lösungsvorschläge nur für Admin/Büro, Techniker sieht das Panel nicht.
> - **Stufe-2-KI** entsprechend reduziert auf Auto-Klassifizierung (Online-Lern-Loop), NL-Search/Reporting, EBO-Filter-Layer, Coach-Modus.
> - Aufwand Stufe 1 indikativ +12–15 PT (siehe Tech-Spec Kapitel 14, v0.4).
>
> **Änderungen v4 gegenüber v3:**
> - **Stufenmodell auf 4 Stufen erweitert** (siehe Abschnitt 4): Stufe 0 Mockup · Stufe 1 MVP-Pilot · Stufe 2 Vollausbau intern · **Stufe 2a Mieter-Portal (optional)** · **Stufe 3 Vermarktung & Plattform-Aktiv**
> - **Stufe 1 enthält die Mockup-Erweiterungen** (Tickettypen, Projekte, Fehlercodes als Stammdaten, Outlook-`mailto:`-Trigger, Konfigurierbarkeits-Layer) — vorher als „Mockup-Stand" markiert, jetzt verbindlich Stufe-1-Scope
> - **EBO-Anbindung präziser eingeordnet:** Schartec-Excel-Import als Workflow erst in Stufe 2, EBO-Live-Anbindung erst in Stufe 3
> - **Mieter-Portal** als eigene Sub-Stufe 2a ausgelöst — damit Stufe 2 ohne Mieter-Portal auslieferbar bleibt
> - **Stufe 3 als Vermarktungs-Stufe** definiert: Multi-Mandant scharf, KI Cross-Mandant, npm-Pakete für Plattform-Core, EBO-Live, Predictive Maintenance
> - **Plattform-Anker-Strategie** verankert (siehe Tech-Spec Kapitel 13): „Plattform-Ready, nicht Plattform-Aktiv" in Stufen 1+2; Distribution erst Stufe 3
>
> **Änderungen v3 gegenüber v2:** Erkenntnisse 2. Joachim-Termin, vierstufige Objektverwaltung, neue Stufe-1-Module (Tickettypen/Projekte/Mail/Konfig), Stufe-2-Detail KI-Sichtbarkeitsschichtung.
> **Änderungen v2 gegenüber v1:** Scope-Schärfung auf Störungs-/Ticketmanagement, EBO + KI nach Stufe 2, PWA als Tag-1-Anforderung.

---

## 1. Ziel

Schlankes Ticket-/Störungsmanagement-System für einen kleinen FM-Betrieb (~10 MA, mehrere Objekte, mehrere Mieter/Eigentümer). Zentrale Erfassung statt Telefon-Chaos, mobiler Zugriff für Techniker, schrittweise EBO-Anbindung. Architektur „Stufe 2 ready", aber Stufe 1 nur das, was sofort intern Mehrwert bringt.

## 2. Zielgruppe & Nutzungskontext

- **Erstanwender:** Joachim Löffler (Inhaber, ~10 MA), Firma im FM-Betrieb. GLT **EcoStruxure (EBO) von Schneider Electric** mit über 2.000 Fehlermeldungen.
- **Schneider-EBO-Vertragspartner:** Firma Schartec — Joachim klärt dort die Frage, ob die Störungscode-Liste per Excel exportiert werden kann (Voraussetzung für die EBO-Anbindung in Stufe 2).
- **Nutzerrollen:** Joachim hat bestätigt, dass **2 Rollen (Admin und Techniker) reichen** („keep it simple"). Die Büro-Rolle bleibt im Modell als Option, in Stufe 1 nicht aktiv ausgerollt (siehe Abschnitt 5.4).
- **Arbeitsumfeld:** viel mobil, draußen, mit Handschuhen → Touch-Targets, große Buttons, wenig Text.
- **Einsatzorte:** Bürohaus, Wohnanlage, Logistikzentrum (gemischtes Objekt-Portfolio mit unterschiedlichen Mietern pro Stockwerk).
- **Bereitschaftsdienst:** Nachtalarme aus EBO landen bei Bereitschaft → muss in Priorisierung greifen.
- **Frau Zwittich** (Joachims Kollegin / Backoffice) hat explizit ein Veto gegen automatische Lösungsvorschläge für die Techniker — Begründung: „Sonst wird die Arbeit zu stupide und die Jungs denken nicht mehr selber nach." Lösungsvorschläge nur im Hintergrund für Admin/Backoffice (siehe Abschnitt 6 — KI).
- **Vermarktungs-Perspektive:** Joachim ist „sofort dabei", wenn aus dem System ein vermarktbares Produkt für vergleichbare FM-Betriebe wird. Hat im 2. Termin bestätigt.

## 3. Leitprinzipien

1. **Kern zuerst** — Ticket-Lifecycle (Eingang → Prüfung → Bearbeitung → Erledigt) ist die Hauptachse. Alles andere ergänzt.
2. **Mobile gleichwertig** — Techniker arbeiten am Handy, kein „Desktop only".
3. **API-First** — jedes UI greift gegen dieselbe API. Mieter-Portal, mobile App, ggf. EBO-Push docken später daran an.
4. **Eingang ≠ Bearbeitung** — Quellen (Telefon, Web, EBO, später Mieter) sauber getrennt von Pool/Workflow, damit weitere Quellen ohne Refactoring andocken.
5. **Keine Lizenz-Lock-ins** — Open-Source-Komponenten, EU-Hosting, eigene Lösung statt teurer Standardsoftware.

## 4. Stufenmodell (verbindlich)

| Stufe | Zielgruppe / Wann | Inhalt | Status |
|-------|-------------------|--------|--------|
| **Stufe 0 — Mockup** | Joachim-Termine 1–3, Aufwandsschätzung | Klickbarer React-Prototyp mit komplettem UX-Umfang Stufe 1. | **Aktuell** — `02_draft/fm-stoerungen/` |
| **Stufe 1 — MVP-Pilot bei Joachim** | Pilot-Objekt, intern, 1 Mandant, ~20 Wochen | Ticket-Lifecycle mit Wartet-auf inkl. Nachunternehmer · vierstufige Objektstruktur (Objekt → Haus → Stockwerk → Einheit) mit Grundriss + Pin · Adressen als eigene Entität · Geschäftspartner n:m + Kontakte · 2 Rollen aktiv (Admin, Techniker) · konfigurierbare Auswahllisten · **Tickettypen** (3 feste mit Custom-Feldern, kein Designer) · **Projekte** als Sammelposten · **Fehlercodes** als Stammdaten + Hydratation im Ticket · **Dokumente** als eigene Stammdaten-Entität mit Drag-and-Drop (Dateien + Outlook-`.msg`/`.eml`-Parser), n:m-Verknüpfung zu Ticket/Projekt/Objekt/Partner, eigener Stammdatenbereich mit Power-Layout-Liste · Outlook-`mailto:`-Trigger · Chat + @-Mentions + Notifications + Browser-Push · Multi-Foto + SVG-Annotationen (eigene Galerie, getrennt von Dokumenten) · 2 Dashboards · PWA installierbar + Offline-Read · Audit-Log (Backend) · **KI-Light: API-Key-Admin-UI · LLM-Gateway produktiv mit Pseudonymisierung · 3 Use Cases live** (Schreibassistenz im Beschreibungs-/Chat-Textfeld · Triage-Vorschlag im Ticket-Anlegen-Modal · Ähnliche-Tickets-Suche als Admin-Side-Panel — Frau-Zwittich-Schichtung). | Geplant |
| **Stufe 2 — Vollausbau intern + Joachim-Erweiterung** | nach Pilot-Feedback, Vorbereitung Vermarktung | **KI-Layer erweitert** (Auto-Klassifizierung als Online-Lern-Loop, NL-Search/Reporting, EBO-Filter-Layer mit Clustering/Self-Healing-Erkennung, Lösungs-Zusammenfassung-Vertiefung, Coach-Modus für Techniker) · **Schartec-Excel-Import** mit Mapping-Wizard + Fehlercode-Lern-Loop · **Volles RBAC** mit Custom-Rollen + Self-Service-Editor · **Reporting/Trends** mit NL-Queries · **Vorlagen-Designer** (volle Tickettyp-Konfiguration) · **Microsoft Graph** für direkten E-Mail-Versand · WebSocket-Realtime statt Polling · erweiterte In-App-Hilfe · **Dokument-Volltextsuche** (PDF-OCR via Tesseract oder Cloud-OCR, Embedding-Suche, KI-Auto-Klassifizierung der Dokument-Kategorie). | Backlog |
| **Stufe 2a — Mieter-Portal** (optional) | als optionale Erweiterung auf Stufe 2 | Externer Login (OIDC-Federation) · Vorab-Triage-Chatbot mit RAG gegen Hausordnung · moderierte Chat-Sicht (Mieter sieht nur eigene Tickets) · KI-Pseudonymisierungs-Layer aktiv. | Backlog, abhängig von Joachims strategischer Entscheidung |
| **Stufe 3 — Vermarktung & Plattform-Aktiv** | weitere Kunden, Tims „eigene Produkte"-Vision | **EBO-Live** über OPC-UA/REST mit KI-Filter-Layer (Clustering, Self-Healing-Erkennung) · **Multi-Mandant scharf** (mehrere Kunden parallel) · **KI Cross-Mandant** mit DSGVO-Pseudonymisierung · npm-Pakete für Plattform-Core (Power-Layout, Adresse, Partner, Audit, RBAC, …) · Native Mobile-Apps falls PWA an Grenzen stößt · Predictive Maintenance · Bereitschafts-Briefing als Hintergrund-Job. | Vision |

Stufe 1 wird so gebaut, dass Stufe 2 ohne Datenmigration aufsetzen kann (Mandanten-/Objekt-/Partner-Trennung im Datenmodell von Anfang an, KI-Hooks und RBAC-Tabellen vorbereitet, Plattform-Anker-Disziplin von Tag 1 — siehe Tech-Spec Kapitel 13).

## 5. Module Stufe 1 (entspricht Mockup-Stand)

### 5.1 Ticket-Pool (Herzstück)

**Felder:** ID (`T-xxxx`), Titel, Beschreibung, Objekt, Partner, Stockwerk, Anlage, Kategorie, Priorität (P1–P4), Status, Quelle, Melder, zugewiesener Techniker, erstellt-am, Foto, Verlauf, Kommentare.

**Status (5 Werte):** `neu` → `pruefung` → `bearbeitung` → `wartet` → `erledigt`. Status-Sprünge auslassen ist erlaubt und wird im Verlauf festgehalten. Der Status `wartet` (für „Wartet auf Material / Mieter / Freigabe / Externe") macht Blockaden sichtbar und ist wesentlich fürs Reporting — siehe Abschnitt 5.7.

**Listenansicht:**
- Tabelle mit konfigurierbaren Spalten (ein-/ausblendbar, Reihenfolge änderbar).
- Mehrfachauswahl-Filter (Status, Priorität, Kategorie, Quelle, Techniker, Objekt, Partner).
- Gruppierung nach Status / Techniker / Objekt / Priorität.
- Sortierung pro Spalte, Suche über Titel/ID/Partner/Beschreibung.
- Default-Sicht: nicht-erledigte Tickets, sortiert nach Priorität + Erstellung.

**Detail-Panel:**
- Statusverlauf zum Durchklicken (Workflow-Knöpfe statt Dropdown).
- Foto-Upload (Handy: Kamerazugriff, Desktop: Datei-Upload).
- Kommentar-Strang chronologisch.
- Zuweisung an Techniker.
- Audit-Log (jede Änderung mit Zeit + User).

### 5.2 Stammdaten

**Objekte — vierstufige Struktur:** Objekt → Haus → Stockwerk → Einheit.

- **Objekt** = Liegenschaft / Standort / Verwaltungseinheit (z. B. „Wohnanlage Sachsenhausen, Schweizer Straße 88"). Felder: Name, Adresse, verknüpfte Partner (n:m, Eigentümer/Auftraggeber auf Objekt-Ebene).
- **Haus** = einzelnes Gebäude / Bauteil / Eingang im Objekt (z. B. „Vorderhaus", „Hinterhaus", „Halle 1"). Joachim hat den Begriff im 2. Termin selbst verwendet. Felder: Bezeichnung, **eigene Adresse** (z. B. „Schweizer Straße 88a" für das Hinterhaus), optionale Notiz.
- **Stockwerk** = Etage im Haus mit **Bezeichnung**, **Ausrichtung Ost/West/Nord/Süd**, **Grundriss-Datei** (PNG/JPG, optional) und **Eigentümer** (1:1 zu Geschäftspartner vom Typ `eigentuemer`, optional). Der Stockwerks-Eigentümer ist nur relevant, wenn das Stockwerk keine Einheiten hat (= ein Mieter besitzt das ganze Stockwerk, z. B. Bürohaus 3. OG = Kanzlei Roth & Partner mit Eigentümer Westend Invest GmbH). Sobald Einheiten angelegt werden, wandert die Eigentümer-Pflege auf Einheit-Ebene. Joachims explizite Anforderung aus dem 3. Konzept-Abgleich: „das Gebäude wäre wichtig, Stockwerk, ob das Ost oder West ist, wäre noch wichtig, die Ausrichtung." plus „auf Ebene Stockwerk sollte man einen Grundriss als PNG oder PDF hinlegen können".
- **Einheit** = konkrete Mieteinheit innerhalb des Stockwerks (z. B. „Wohnung 2.1", „Büro 4.02", „Lagerbox 12"). Felder: Bezeichnung, Größe in m² (optional), **Mieter** (n:m zu Geschäftspartnern vom Typ `mieter`), **Eigentümer** (1:1 zu Geschäftspartner vom Typ `eigentuemer`, optional). Joachims Wort: „auf Ebene des Stockwerks benötigen wir noch eine Option, Einheiten anlegen … in der Wohnung sollte man einen Eigentümer hinterlegen können sowie einen Mieter".

**Mieter- und Eigentümer-Zuweisung:**
- Mieter werden primär an der **Einheit** gepflegt (n:m, ein Mieter kann theoretisch über mehrere Einheiten gehen). Wenn ein Stockwerk keine Einheiten hat (= ein Mieter besitzt das ganze Stockwerk, z. B. Kanzlei Roth & Partner im 3. OG des Bürohauses), wird der Mieter direkt am Stockwerk hinterlegt (Fallback).
- Eigentümer wird pro Einheit als 1:1 gepflegt (typische WEG-Realität: jede Wohnung hat genau einen Eigentümer). Auf Objekt-Ebene gibt es zusätzlich Eigentümer/Auftraggeber als Stammdaten — z. B. die übergeordnete WEG (Wohnungseigentümergemeinschaft).
- **Mehrpersonen-Partner (Ehepaar, Erbengemeinschaft, GbR):** In Stufe 1 nicht im Datenmodell abgebildet — als einzelner Geschäftspartner-Eintrag mit Sammelbezeichnung („Ehepaar Schmidt") behandeln. Erweiterung der Geschäftspartner-Stammdaten um mehrere Personen pro Partner-Eintrag steht in der **Offene Punkte** (Abschnitt 11).

**Tree-Layout in der UI:** Die Objekt-Detailansicht wird als Baum dargestellt (Objekt → Haus → Stockwerk → Einheit), mit Expand/Collapse pro Ebene und Such-Filter im Baum. Edit-Aktionen pro Knoten bleiben als Sub-Modal. Begründung: Bei einem mittelgroßen Joachim-Objekt-Portfolio entstehen schnell 10+ Häuser × 3+ Stockwerke × 4+ Einheiten = 100+ Knoten — Listendarstellung wird unhandhabbar.

**Skalierbarkeit der Mieter/Eigentümer-Auswahl:** Bei wachsendem Geschäftspartner-Bestand (potenziell 100+ Mieter über alle Objekte) wird die heutige Checkbox-Liste unhandhabbar. Spätestens in Stufe 1 wird die Auswahl auf ein **Search-Dropdown** umgestellt (Eingabefeld + Filter + ausgewählte Werte als Chips). Im Mockup ist die Checkbox-Liste noch ausreichend, da die Demo-Daten klein bleiben.

**Dynamische Ebenen-Sichtbarkeit in der UI** (zwei Stellen, gleiches Prinzip):

| Ebene | Datenmodell-intern | Wann sichtbar in UI |
|-------|---------------------|---------------------|
| **Haus** | jedes Objekt hat min. 1 Haus | nur wenn 2+ Häuser. Beim Anlegen des 2. Hauses Dialog „Wie soll das bestehende Haus heißen?" (Default „Haupthaus"). |
| **Einheit** | optional (0..N pro Stockwerk) | nur wenn 1+ Einheit. Beim Anlegen der 1. Einheit Dialog „Sollen die bisherigen Stockwerks-Mieter in eine erste Einheit übernommen werden?" |

Im Ticket-Formular zeigt sich dieselbe Dynamik: Haus-Select erscheint nur bei Mehrhaus-Objekten, Einheit-Select nur bei Stockwerken mit Einheiten.

**Grundriss + Pin-Setzen:**

- **Hinterlegen:** Pro Stockwerk kann eine Grundriss-Datei hochgeladen werden (PNG / JPG, im Mockup als Base64 im Browser-State; in Stufe 1 echtes Objekt-Storage). PDF-Support folgt in Stufe 1 (PDF wird serverseitig als Bild gerendert).
- **Pin pro Ticket:** Beim Ticket-Erfassen erscheint nach Auswahl von Stockwerk (und optional Einheit) der Grundriss als interaktives Bild. Klick auf den Grundriss setzt einen Pin (x/y-Koordinaten in % gespeichert). Der Pin wird im Ticket-Detail wieder angezeigt — Joachim und der Techniker sehen die genaue Lage der Störung.
- **Mehrere Tickets je Stockwerk:** In der Stockwerks-Ansicht bzw. im Ticket-Detail werden alle Pins offener Tickets desselben Stockwerks überlagert, farblich nach Priorität — Joachim sieht auf einen Blick „in diesem Stockwerk gibt's drei aktive Störungen, eine davon kritisch".
- **Stufe 2:** Pin pro Einheit als statischer Default, der vom Ticket geerbt und überschrieben werden kann; PDF-Grundrisse; Heatmap-Auswertung wiederkehrender Stellen.

**Begründung der vierstufigen Struktur:** FM-Realität — Wohnanlagen und gemischt genutzte Bürohäuser haben pro Stockwerk mehrere Mieteinheiten, jede mit eigenem Mieter. Ohne Einheit-Ebene müsste der Mieter „Wohnung 2.3" als Freitext im Ticket landen, was Auswertbarkeit und Mieter-Stammdaten-Anbindung entwertet. Die dynamische Sichtbarkeit hält die UX für einfache Fälle (1 Mieter pro Stockwerk) genauso schlank wie zuvor.

Im Mockup-Stand sind Objekte noch flach (Name + Adresse + n:m zu Partnern). Erweiterung auf Haus → Stockwerk → Einheit, Haus-Adresse und Grundriss+Pin ist eine **Stufe-0-Erweiterung** vor der 3. Joachim-Demo (siehe Abschnitt 12).

**Geschäftspartner — flaches Modell mit Typen:** `mieter`, `eigentuemer`, `auftraggeber`, `nachunternehmer` (statt nur „dienstleister" — Joachim verwendet konsequent den Begriff Nachunternehmer für externe Gewerke). Felder: Name, Ansprechpartner, E-Mail, Telefon, Adresse, Notiz. **Keine Hierarchie GP→Niederlassung→Kontakt** in Stufe 1.

**Benutzer/Mitarbeiter** — Name, E-Mail, Telefon, Rolle, Aktiv-Flag, Initialen für Avatare.

**Adressen — eigene Stammdaten-Entität:** Strukturierte Felder (Straße, Hausnummer, Adresszusatz, PLZ, Ort, Land, Bemerkung) statt Freitext am Objekt/Haus/Partner. Objekt, Haus und Geschäftspartner referenzieren eine Adresse über `adresseId` (n:1) — eine Adresse kann mehrfach genutzt werden (mehrere Mieter an derselben Wohnungsadresse, Bürohaus mit drei Mietern, WEG-Verwaltung als Kontaktadresse). Eigene UI als Sidebar-Eintrag mit Listenansicht, Spalten-Filter und Inline-Anlegen aus jeder AdressCombobox. Begründung: **Datenqualität** (keine Tippfehler, einmal richtig erfasst), **Wiederverwendung**, **Filter/Reports** („alle Tickets in PLZ 60314"), **DSGVO** (Adress-Daten zentral gekapselt), **internationale Adressen** (Land-Feld). In Stufe 1 echte Tabelle mit PLZ-Validierung und optionaler Geokodierung.

### 5.3 Dashboards (rollenabhängig)

**Admin-Dashboard:** Status-Verteilung, Auslastung Techniker (offene Tickets je Person), Top-Partner nach Ticket-Aufkommen, Watchlist (kritische/eskalierte Tickets), heute erledigte Tickets, Kategorien-Mix.

**Techniker-Dashboard:** persönlicher Tagesplan, eigene offene Tickets nach Priorität, „nächste Aufgabe", Kontakt-Quick-Links.

### 5.4 Rollen & Rechte

| Rolle | Sichtbarkeit | Schreibrechte |
|-------|--------------|---------------|
| **Admin** | alle Tickets, Stammdaten, Benutzerverwaltung | alles inkl. Zuweisung, Stammdaten-Pflege |
| **Techniker** | eigene Tickets + Pool (lesend) | eigene Tickets bearbeiten, Foto, Kommentare, Status fortschreiben |
| **Büro** | Tickets erfassen + sehen | Ticket-Erfassung, keine Stammdaten- oder Benutzerverwaltung |

Rollenlogik abstrahiert (kein Hardcoding) → Stufe 2 kann feinere Rechte ergänzen.

### 5.5 Eingangskanäle (Quelle-Tracking)

Jedes Ticket trägt eine Quelle: `telefon` | `manuell` | `web` (später: `mieter`, `ebo`). In Stufe 1 sind nur Telefon und manuelle Erfassung real relevant — Tickets aus Bereitschaftsanrufen und Vor-Ort-Beobachtungen der Techniker.

**EBO ist explizit nicht Teil von Stufe 1** (siehe Abschnitt 6). Begründung: die Schneider-API-Klärung ist Risikofaktor mit unbekanntem Zeithorizont, und EBO ohne vorgeschalteten Filter-Layer (Clustering, Self-Healing-Erkennung) erzeugt Notification-Müdigkeit, die das gesamte System entwertet. Beides — EBO-Anbindung und der KI-gestützte Filter-Layer — gehört in Stufe 2.

### 5.6 Chat & Benachrichtigungen

**Trennung Audit ↔ Konversation:** Der Ticket-Verlauf wird automatisch befüllt (Status-Wechsel, Zuweisung, Foto-Upload, Wartet-auf-Grund, System-Events) und im Backend persistiert — **aber in Stufe 1 nicht mehr in der UI angezeigt**. Begründung: bei Joachims Größe (10 MA) liest niemand täglich Audit-Listen, sie blähen das Detail-Panel nur auf. Die Daten bleiben fürs Compliance/Streit-Szenario zugänglich (Backend-Query, später ggf. Reporting-View). Daneben existiert der **Chat** als einzige sichtbare Aktivitäts-Spur mit Bubble-Darstellung, Avataren und Zeitstempel — das, was die Mitarbeitenden tatsächlich nutzen. Diese saubere Datenmodell-Trennung zahlt sich in Stufe 2 aus, sobald Mieter mitkommunizieren sollen, ohne den internen Audit zu sehen, und falls eine Audit-View doch gewünscht wird, kann sie problemlos nachgerüstet werden.

**Sichtbarkeit Stufe 1:** Alle internen Rollen (Admin, Techniker, Büro) lesen und schreiben den gesamten Chat. Sicht-Filter (z. B. Mieter sieht nur moderierte Nachrichten) folgen in Stufe 2.

**@-Mentions:**
- Eingabefeld erkennt `@` und öffnet Autocomplete mit aktiven Mitarbeitern (Avatar, Name, Rolle).
- Auswahl wird als hervorgehobenes Token gerendert.
- Stufe 1: nur User-Mentions. Objekt-/Partner-Mentions in Stufe 2.

**Benachrichtigungen — Auslöser:**
| Auslöser | Zielnutzer | Priorität |
|----------|------------|-----------|
| @-Mention im Chat | erwähnter User | hoch (Browser-Push + In-App-Toast) |
| Neue Zuweisung | zugewiesener User | hoch |
| Status-Wechsel in „meinem" Ticket | zugewiesener User + Erfasser | normal |
| Neue Chat-Nachricht in zugewiesenem Ticket | zugewiesener User (außer Autor) | normal |

**Notification-Kanäle:**
- **In-App-Toast** (3 s sichtbar, rechts unten) — immer
- **Bell-Icon im Header** mit Badge (ungelesen) → Dropdown-Panel mit Liste, Klick öffnet Ticket
- **Browser-Push** (Web Notifications API): nach einmaliger Permission-Abfrage echte OS-Notifications, auch wenn der Tab im Hintergrund ist
- **Mobile (Phase 2):** PWA Push Notifications für echte Native-Erfahrung; im aktuellen Mockup-Phone wird der gleiche In-App-Toast angezeigt
- **E-Mail-Fallback** (Stufe 1 optional): wenn User > 24 h nicht eingeloggt war und Mention/Zuweisung offen → Mail mit Deep-Link

**Read-Receipts:** Pro Nachricht wird mitgeführt, wer sie gelesen hat (Klick auf Ticket = automatisch als gelesen markiert für aktiven User). Anzeige zunächst dezent (z. B. kleine Avatar-Reihe unter der Nachricht); volle Lesebestätigungs-Logik in Stufe 2.

**Edit / Delete:** In Stufe 1 nicht — Nachrichten sind unveränderlich (vereinfacht Audit-Anforderungen). Korrektur durch neue Nachricht.

### 5.7 Wartet-auf-Status (Blockaden sichtbar machen)

Der Status `wartet` ist kein Mülleimer-Status, sondern ein erzwungenes „Was blockiert hier?". Beim Setzen von `wartet` wählt der Bearbeiter einen Sub-Grund:

- **wartet-material** — Ersatzteile bestellt, noch nicht da
- **wartet-mieter** — Mieter muss Termin bestätigen / Zugang ermöglichen
- **wartet-freigabe** — Auftraggeber-Freigabe für größere Maßnahme nötig
- **wartet-extern** — Externer Nachunternehmer ist beauftragt. **Pflichtfeld:** konkreter Nachunternehmer (Verknüpfung zu Geschäftspartner vom Typ `nachunternehmer`) plus Ansprechpartner, Telefon und E-Mail (kommen automatisch aus dem Stammdatensatz, sind aber pro Ticket überschreibbar — manchmal ist's eine andere Person als die im Stamm)

**Warum das Sub-Konzept wichtig ist:** Joachim sieht im Dashboard auf einen Blick, **wo er als Chef einhaken muss**. „3 Tickets warten auf Auftraggeber-Freigabe seit > 5 Tagen" ist eine konkrete Aktion (Eigentümer anrufen), nicht ein diffuses „liegt rum". Der Wartet-auf-Sub-Status ist Stufe-1-relevant, weil er **ohne Mehraufwand entsteht** (ein zusätzlicher Klick beim Status-Setzen) und sofort Reporting-Wert liefert.

**Anzeige:** Wartet-Status wird in Listenansicht mit Sub-Grund-Pille gerendert („Wartet auf Material"), nicht nur als Status-Wert.

### 5.8 Foto-Bearbeitung (Multi-Foto + Annotationen)

**Joachims Anforderung (bestätigt im 2. Termin):** „Ein, zwei mehr ist das nicht. Mehr brauchst du ja auch nicht. Es geht ja nur darum, dass man sieht, was das ist, oder falls ich da nochmal reingucke, dass ich weiß, um was es geht." → **typischer Use-Case sind 1–2 Fotos pro Ticket**.

Das Mockup unterstützt aus Architekturgründen schon mehrere Fotos (Galerie statt Single-Slot — kostet kaum mehr Aufwand), die Annotations-Funktion ist Wertsteigerung ohne Mehraufwand fürs Backend.

**Annotationen direkt im Browser** (kein externes Tool nötig):
- **Markierungs-Kreis** — Bereich umkreisen
- **Text-Stempel** — vorgegebene Marker („Defekt", „Prüfen", „OK") in Rot/Gelb/Grün
- **Edit-Stift-Modus** auf jedem Foto → Annotationen werden als SVG-Overlay auf dem Foto gespeichert (Original bleibt erhalten)

**Warum:** Spart Erklärtext und Missverständnisse. Mobile + Web identisch. Implementation in Stufe 1 mit SVG-Overlay; das annotierte Bild wird beim Export (z. B. an Nachunternehmer) zu einem PNG gerendert.

**Stufe 1 NICHT:** Crop, Filter, Skalierung, Pfeil-Werkzeug, Mehrfach-Bearbeitung. Reduzierter Tool-Satz reicht für Joachims Use-Case.

### 5.9 PWA — Progressive Web App

Stufe 1 wird **direkt als PWA** ausgeliefert, nicht als „erstmal Web, später PWA":

- **Installierbar** auf Homescreen (Android, iOS, Desktop) — wirkt wie native App
- **App-Icon, Splash-Screen, eigener App-Window-Modus** (ohne Browser-Chrome)
- **Service Worker** mit Cache-First-Strategie für Static Assets → App startet auch offline (Tiefgaragen, Heizungskeller, Kellerräume haben oft kein Netz)
- **Offline-Fallback-Page** wenn API nicht erreichbar — zeigt zuletzt geladene Tickets read-only mit Hinweis „Offline — Änderungen werden nach Verbindung synchronisiert"
- **Install-Prompt** im UI (nicht nur Browser-Default), nach erstem Login einmalig

**Warum direkt als PWA:** Die spätere Migration „Web → PWA" ist konzeptionell aufwändiger als gleich PWA zu bauen (Service Worker, Manifest, Caching-Strategie). Plus: Joachim und seine Techniker akzeptieren ein Icon auf dem Homescreen viel eher als „eine Webseite, die man bookmarkt" — das ist UX-relevant für Adoption.

**Stufe 2:** Echtes Background-Sync (Tickets im Offline-Modus erfassen, später synchronisieren), PWA Push Notifications.

### 5.10 Tickettypen (Reparatur / Wartung / Baubegehung)

**Joachims Anforderung:** „Du kannst oben einen Reiter anklicken, wo sagt Wartung, und dann siehst du, was für Wartungen demnächst kommen." Plus Tims Warnung: „Wenn du immer alles hast von allen möglichen Ticketvarianten, dann wird es ein riesiges Formular und keiner findet sich mehr zurecht." → Tickettypen mit **unterschiedlichen Pflichtfeldern und unterschiedlichen Listen-Ansichten**.

**Tickettypen in Stufe 1:**

| Typ | Zusätzliche Pflichtfelder | Eigene Listenansicht |
|-----|---------------------------|----------------------|
| **Reparatur** (Default) | wie heute | normaler Ticket-Pool / Kanban |
| **Wartung** | Fälligkeitsdatum, geplanter Dienstleister (Nachunternehmer), Wiederholungsmuster (einmalig / jährlich / halbjährlich / quartalsweise) | Eigener Reiter „Wartungen" mit Kalender-/Zeitstrahl-Sicht, Vorlauf-Warnung („nächste 30 Tage") |
| **Baubegehung** | geplanter Termin, Begeher, Begehungsobjekt(e) | Eigener Reiter „Begehungen" |

**Reminder-Mechanik:** Bei Tickettyp `wartung` mit Fälligkeitsdatum bekommt der zugewiesene Bearbeiter eine Notification N Tage vorher (default 7 Tage, konfigurierbar pro Tickettyp).

**Architektur:** `tickettyp` ist Stammdatensatz, nicht hartcodiert (siehe Abschnitt 5.13 — Konfigurierbarkeit). Jeder Tickettyp definiert sein Feld-Set, seine Pflichtfelder, seine Listen-Spalten. Stufe 1 liefert die drei genannten Typen mit, in Stufe 2 kann Joachim weitere selbst anlegen.

**Stufe 1 NICHT:** vollständiger Vorlagen-Designer (das war ursprünglich in plan v1) — der kommt in Stufe 2. Stufe 1 hat **drei feste Typen** mit jeweils festem Feld-Set.

### 5.11 Projekte (Sammelposten für Großvorhaben)

**Joachims Wort:** „Du kannst schon unterscheiden, vielleicht zwischen Tickets und Projekten." Tim ergänzte das mit seinem Renovierungs-Beispiel — ein größeres Vorhaben hat Untertickets (Nachunternehmer einkaufen, Badmöbel, Abriss, …).

**Projekt-Struktur in Stufe 1:**
- Projekt-Felder: Name, Beschreibung, Objekt (optional), verantwortlicher Mitarbeiter, Start-/Ende-Datum, Status (geplant / laufend / abgeschlossen / storniert), Notizen
- **N:1-Beziehung Ticket → Projekt** (jedes Ticket kann optional einem Projekt zugeordnet werden, ein Projekt hat 0–N Tickets)
- Projekt-Detailansicht zeigt alle zugeordneten Tickets (gruppierbar nach Status / Tickettyp), plus eigene Beschreibung und Verlauf
- Sidebar-Eintrag „Projekte" oberhalb von „Objekte"

**Stufe 1 NICHT:** Projekt-Abrechnung, Projekt-Budget-Tracking, Gantt-Charts, Ressourcenplanung. Reines „Container"-Konzept, keine Projektmanagement-Funktionen.

**Stufe 2:** Aufträge als Zwischenebene zwischen Projekt und Ticket (aus altem plan v1), Abrechnungsbezug.

### 5.12 E-Mail-Integration (Office 365 / Outlook)

**Joachim nutzt Office 365.** Zwei konkrete Wünsche aus dem 2. Termin:

**A) Outgoing: Standardisierte E-Mail aus Ticket generieren**
- Knopf im Ticket-Detail: „E-Mail an Beteiligte senden"
- Empfänger werden aus dem Ticket abgeleitet: Nachunternehmer (TO), Auftraggeber (CC), Joachim selbst (BCC)
- Inhalt: Ticket-ID, Titel, Objekt, Beschreibung, Foto(s) angehängt, eventuell Fälligkeitsdatum
- Versand-Modus zwei Varianten:
  - **Outlook-Trigger** (Default): öffnet Outlook mit vorbefülltem Entwurf, User klickt „Senden" → keine Backend-Komplexität
  - **Direkter Versand** über Microsoft Graph API (späterer Ausbau): braucht App-Registrierung in Joachims Azure AD, mehr Aufwand

**B) Incoming: E-Mail per Drag-&-Drop ins Ticketsystem**
- User zieht eine E-Mail aus Outlook auf das System-Fenster → System erstellt Ticket mit Absender als Melder, Betreff als Titel, Body als Beschreibung, Anhänge als Foto(s)/Dokumente
- Browser-natives Drag-&-Drop reicht (HTML5 `dataTransfer`)
- Outlook-Mail-Format: `.msg` parsen → MIME-Header extrahieren

**Beide Varianten brauchen Senior-Entwickler-Klärung** vor finaler Aufwandsschätzung. Variante A (Outlook-Trigger über `mailto:`-Link mit voller Adressliste, Betreff, Body) ist trivial in Stufe 1 — direkter Graph-API-Versand und `.msg`-Parsing können in Stufe 2 wandern.

### 5.13 Konfigurierbarkeits-Layer

**Joachims Wort:** „Möglichst flexibel, dass man nicht neu programmieren muss, sondern alles konfigurativ lösen kann." Tim hat im Gespräch zugesagt.

**Konkret konfigurierbar (über Admin-Settings, keine Code-Änderung):**
- Status-Liste (Werte, Reihenfolge, Farben, Workflow-Regeln)
- Tickettypen (Name, Pflichtfelder, Listen-Spalten, Reminder-Vorlauf)
- Kategorien (Klima, Heizung, Elektro, … — frei erweiterbar)
- Prioritäten (Anzahl Stufen, Bezeichnungen, Farben)
- Wartet-auf-Sub-Gründe
- Eingangskanäle (`telefon`, `web`, `manuell`, später `mieter`, `ebo`)

**Architektur:** Diese Werte liegen in eigenen Stammdaten-Tabellen (statt als ENUMs in der Datenbank). UI ist im Admin-Bereich (eigener Reiter „Konfiguration"). Stufe 1 liefert sinnvolle Defaults mit, die Joachim oder ein Admin nach Bedarf anpasst.

**Stufe 1 NICHT konfigurierbar:** Rollen-Logik (Admin/Techniker hartcodiert), Datenmodell selbst (keine Custom Fields), UI-Layout. Diese Limitierung ist bewusst — vollständige Konfigurierbarkeit treibt die Komplexität hoch ohne kurzfristigen Mehrwert.

## 6. Module Stufe 2 (Backlog, nicht in Stufe 1)

- **EBO-Anbindung mit Schartec-Störungscode-Import:** Schartec hält ~2.000 Störungscodes. Joachim klärt, ob Schneider/Schartec die Codes per Excel-Export rausgeben. Workflow: Excel-Import in eigenen Reiter „Störungscode-Verwaltung" → bei eingehender Code-Meldung wird das Ticket automatisch vorbefüllt (Gebäude, Raum/Anlage, Standard-Beschreibung). Optional lernendes System: Code + bisherige Lösungen → Vorschlag-Anreicherung.
- **EBO-Live-Anbindung** über REST/OPC-UA, **immer mit vorgeschaltetem KI-Filter-Layer** (siehe nächster Punkt). Schneider-API-Klärung ist Voraussetzung. EBO ohne Filter wird bewusst nicht gemacht — Begründung siehe Abschnitt 5.5.
- **KI-Layer mit Sichtbarkeits-Schichtung:**
  - **Auto-Klassifizierung beim Eingang** (Kategorie, Prio, Objekt-Zuordnung) — sichtbar für alle, mit Confidence-Indikator
  - **EBO-Cluster + Self-Healing-Erkennung** — System-intern, keine UI
  - **Ähnliche-Tickets-Suche per Embeddings** — sichtbar als Seitenpanel für **Admins** im Ticket-Detail
  - **Lösungsvorschläge aus Historie** — **nur für Admin-Rolle sichtbar**, NICHT für Techniker (Frau Zwittichs Veto — siehe Abschnitt 2). Idee: Admin kann beim Telefonat mit dem Techniker nachfragen „hast du nach dem und dem schon geschaut?" ohne dass der Techniker fertig vorgekauten Lösungsweg bekommt
  - **Smart Reporting mit Natural-Language-Queries** — Admin-only
  - Modell-Mix: lokal (Klassifizierung, Embeddings, in EU-Cloud) + Cloud (komplexes Reasoning über Anthropic/OpenAI EU-Endpoints) mit DSGVO-Pseudonymisierung
  - Kosten-Indikation: ~50–100 €/Monat bei Joachims Größe (Token-basiert)
- **KI-Frontend zur Ticket-Erfassung:** unstrukturierter Input (Telefon-Notiz, Mieter-Mail, Bereitschafts-Anruf) → KI strukturiert zu Ticket-Vorschlag. Tim klärt mit Bekanntem („KI-Schicht vor der Datenbank").
- **Grundrisse pro Stockwerk mit Pin-Setzen:** Tims Idee aus früherem Mangelmanagement, Joachim findet's super. Workflow: Pro Stockwerk wird Grundriss-PNG/PDF hinterlegt, beim Ticket-Erfassen klickt User auf den Grundriss → Pin wird gesetzt → Lage genau dokumentiert. Wirkt besonders bei größeren Objekten und für Nachunternehmer, die das Gebäude nicht kennen.
- **Mieter-Portal:** externe Erfassung mit Auth, KI-Vorab-Triage, moderierte Chat-Sicht (Mieter sieht nur Konversation, nicht den internen Audit)
- **Reporting & Trends:** Auslastung, MTTR, wiederkehrende Probleme je Objekt/Anlage/Anlagenkomponente, Wartet-auf-Ageing
- **Aufträge** als Zwischenebene zwischen Projekt und Ticket (aus plan v1), Abrechnungsbezug
- **Vorlagen-Designer / Checklisten** — übernommen aus plan v1 (Stufe 1 hat nur die drei festen Tickettypen)
- **Erweiterte Anlagen-/Asset-Stammdaten** mit Wartungshistorie pro Anlage
- **PWA Background-Sync** (Offline-Erfassung mit späterer Synchronisation), echte Push Notifications über Service Worker
- **Microsoft Graph API** für direkten E-Mail-Versand aus dem System (Stufe 1: Outlook-Trigger reicht)
- **Native Mobile-App** falls PWA-Limitierungen (Hardware-Zugriffe, App-Store-Präsenz) Probleme machen

## 7. UI/UX

- **Stil aus Mockup:** dunkles Theme (zinc-950), Akzent Emerald-500, IBM Plex Sans, technisch-nüchtern, hoher Kontrast.
- **Responsive Web-App** — Sidebar-Navigation auf Desktop, kollabiert auf Mobile.
- **Touch-Targets ≥ 44 px** auf Mobile.
- **Keine native App in Stufe 1** — Web reicht, kann als PWA installierbar gebaut werden.

## 8. Tech-Stack

| Bereich | Wahl Stufe 0 (gesetzt) | Wahl Stufe 1 (Empfehlung) | Begründung |
|---------|------------------------|---------------------------|------------|
| Frontend-Framework | **React 18 + Vite 6** | übernehmen | Mockup ist Vite-basiert, unkomplizierter Umstieg auf Next.js wäre möglich, lohnt aber nicht. |
| Styling | **TailwindCSS 3** | übernehmen | Schnelle Entwicklung, im Mockup verankert. |
| Icons | **lucide-react** | übernehmen | Bereits genutzt. |
| Charts | **recharts** | übernehmen | Bereits genutzt im Admin-Dashboard. |
| Backend | — | **Node + Fastify** *oder* **Python + FastAPI** | Entscheidung im Mockup-Review. Beide tragfähig. Tendenz: FastAPI bei späterer KI-Integration, Fastify bei JS-Single-Stack. |
| Datenbank | — | **PostgreSQL** | Relationen (Objekt ↔ Partner, Tickets ↔ Verlauf), Audit-Log, JSONB-Felder für flexible Felder. |
| Auth | — | **OIDC / OAuth2** (z. B. Auth.js, Keycloak), MFA für Admins | Passt zu Rollenmodell, vorbereitet für externes Mieter-Portal in Stufe 2. |
| File-Storage | — | **S3-kompatibel** (MinIO self-host oder Hetzner Object Storage) | Für Fotos zu Tickets. |
| Hosting | — | **EU-Region** (Hetzner / Azure EU) | DSGVO, Datenresidenz. On-Premise möglich, falls Joachim das wünscht. |
| Bildkomprimierung | — | `browser-image-compression` | Spart Speicher, im Browser vor Upload. |

**Geschätzte laufende Kosten Stufe 1:** Server + DB + Storage in EU-Cloud → 30–80 €/Monat je nach Anbieter, inkl. Backup. (Indikativ, vor Aufwandsschätzung nicht verbindlich.)

## 9. Datenmodell-Skizze (Stufe 1)

```
-- Stammdaten Konfiguration (über Admin-UI pflegbar, siehe 5.13)

status
  id (string, PK), label, farbe, reihenfolge, ist_endzustand (bool)

tickettyp
  id (string, PK), label, beschreibung, pflichtfelder (jsonb), default_reminder_tage (int)

kategorie
  id (string, PK), label, icon, farbe

prioritaet
  id (int, PK), label, farbe

wartet_grund
  id (string, PK), label, beschreibung

eingangskanal
  id (string, PK), label

-- Tickets & Projekte

projekt
  id, name, beschreibung
  objekt_id → objekt (nullable)
  verantwortlich_user_id → benutzer (nullable)
  start_am, ende_am, status (geplant/laufend/abgeschlossen/storniert)
  notizen, erstellt_am

ticket
  id (T-xxxx, string)
  tickettyp_id → tickettyp     -- bestimmt das Feld-Set
  projekt_id → projekt (nullable)
  titel, beschreibung
  objekt_id → objekt
  haus_id → haus (nullable)                   -- denormalisiert für Filter/Listen
  stockwerk_id → objekt_stockwerk (nullable)  -- ersetzt das alte Freitext-Feld
  einheit_id → stockwerk_einheit (nullable)   -- nur wenn das Stockwerk Einheiten hat
  pin_x, pin_y (nullable, decimal 0..100)     -- Position auf dem Grundriss in %
  partner_id → geschaeftspartner (nullable)  -- der Mieter/Auftraggeber, der's gemeldet hat
  anlage                       -- frei, später ggf. relational zu anlage-Tabelle
  kategorie_id → kategorie
  prio_id → prioritaet
  status_id → status
  wartet_grund_id → wartet_grund (nullable, nur wenn status='wartet')
  wartet_nachunternehmer_id → geschaeftspartner (nullable, nur wenn wartet_grund='extern')
  wartet_kontakt_name, wartet_kontakt_telefon, wartet_kontakt_email  -- pro Ticket überschreibbar
  quelle_id → eingangskanal
  melder (frei)
  zugewiesen_user_id → benutzer (nullable)
  faelligkeit_am (nullable, Pflicht bei tickettyp='wartung')
  wiederholung (nullable, für Wartung: einmalig/jaehrlich/halbjaehrlich/quartal)
  erstellt_am, erledigt_am

ticket_verlauf  -- Audit-Log auf Ticket-Ebene (immutable)
  id, ticket_id → ticket
  zeit, text, user_id → benutzer
  typ (status_wechsel/zuweisung/foto/system)

ticket_message  -- Chat-Konversation (separat vom Audit)
  id, ticket_id → ticket
  user_id → benutzer
  text, erstellt_am

ticket_mention
  id, message_id → ticket_message
  user_id → benutzer

ticket_message_read
  message_id → ticket_message
  user_id → benutzer
  gelesen_am
  PRIMARY KEY (message_id, user_id)

notification
  id, user_id → benutzer (Empfänger)
  ticket_id → ticket
  typ (mention/zuweisung/status/chat/wartung_faellig)
  text, ref_message_id → ticket_message (nullable)
  ausloeser_user_id → benutzer (nullable)
  gelesen, erstellt_am

ticket_foto
  id, ticket_id, storage_url, hochgeladen_am, user_id
  annotationen (jsonb)  -- SVG-Overlay-Daten (Marker + Kreise)

-- Adressen (eigene Entität, mehrfach referenziert)

adresse
  id, strasse, hausnummer, adresszusatz (nullable),
  plz, ort, land (default "DE"),
  bemerkung (nullable),
  geo_lat, geo_lon (nullable, für spätere Karten/Routing-Features)

-- Objekte, Häuser, Stockwerke & Einheiten (vierstufig)

objekt
  id, name, adresse_id → adresse (nullable)

haus
  id, objekt_id → objekt
  bezeichnung (z. B. "Vorderhaus", "Hinterhaus", "Halle 1")
  adresse_id → adresse (nullable, leer = erbt vom Objekt)
  notiz, reihenfolge (int, für Sortierung)
  -- Jedes Objekt hat mindestens ein Haus. Bei nur einem Haus
  -- wird die Ebene in der UI unsichtbar (Haus = Objekt).

objekt_stockwerk
  id, haus_id → haus       -- statt direkt objekt_id
  bezeichnung (z. B. "3. OG", "EG", "1. UG")
  ausrichtung (ost/west/nord/sued, nullable)
  grundriss_file_key (nullable)      -- S3-Key der Grundriss-Datei (PNG/JPG/PDF)
  grundriss_mime (nullable)          -- z. B. "image/png", "application/pdf"
  eigentuemer_partner_id → geschaeftspartner (nullable, nur Partner vom Typ 'eigentuemer')
  -- Nur relevant wenn das Stockwerk keine Einheiten hat (0-Einheiten-Modus).
  -- Bei Einheiten wandert die Eigentümer-Pflege auf Einheit-Ebene.
  reihenfolge (int, für Sortierung)

stockwerk_einheit
  id, stockwerk_id → objekt_stockwerk
  bezeichnung (z. B. "Wohnung 2.1", "Büro 4.02")
  groesse_qm (nullable, decimal)
  eigentuemer_partner_id → geschaeftspartner (nullable, nur Partner vom Typ 'eigentuemer')
  reihenfolge (int)
  -- Optional: Stockwerk kann 0..N Einheiten haben.
  -- Bei 0 Einheiten: Mieter wird direkt am Stockwerk gepflegt (s.u.).
  -- Bei 1+ Einheiten: Mieter wird an der Einheit gepflegt.

einheit_mieter  -- n:m
  einheit_id → stockwerk_einheit
  partner_id → geschaeftspartner  -- nur Partner vom Typ 'mieter'
  PRIMARY KEY (einheit_id, partner_id)

stockwerk_mieter  -- n:m, Fallback wenn Stockwerk keine Einheiten hat
  stockwerk_id → objekt_stockwerk
  partner_id → geschaeftspartner  -- nur Partner vom Typ 'mieter'
  PRIMARY KEY (stockwerk_id, partner_id)
  -- In der UI nur sichtbar, wenn das Stockwerk keine Einheiten hat.

objekt_partner  -- n:m für Eigentümer, Auftraggeber, Nachunternehmer auf Objekt-Ebene
  objekt_id, partner_id

geschaeftspartner
  id, name, typ (mieter/eigentuemer/auftraggeber/nachunternehmer),
  ansprechpartner, email, telefon, adresse_id → adresse (nullable), notiz

benutzer
  id, name, email, telefon, rolle (admin/techniker/buero), aktiv, passwort_hash
```

**Mandantenfähigkeit:** Alle Tabellen bekommen `mandant_id` von Anfang an. In Stufe 1 nur ein Mandant befüllt — das ist die Vorbereitung für Stufe 2.

**Anmerkungen zum Modell:**
- `tickettyp.pflichtfelder` als JSONB-Feld ermöglicht, ohne Schema-Änderung neue Pflichtfeld-Logik je Tickettyp zu definieren (z. B. `{"fields": ["faelligkeit_am", "wartet_nachunternehmer_id"]}`)
- `status`, `kategorie`, `prioritaet`, `wartet_grund`, `eingangskanal` sind alle als eigene Tabellen modelliert (statt ENUMs), damit Konfigurierbarkeit aus Abschnitt 5.13 funktioniert
- `objekt_stockwerk` ersetzt das alte Freitext-Feld `stockwerk` im Ticket — beim Migrationsstart wird das Mapping einmalig manuell gemacht (10 MA, überschaubares Objekt-Portfolio)

## 10. Sicherheit / DSGVO

- **DSGVO by design:** EU-Hosting, Auftragsverarbeitungsvertrag mit Hoster, klare Löschkonzepte für Personenbezug (Mieter-Daten in Stufe 2).
- **Audit-Log** auf Ticket-Ebene Pflicht.
- **MFA** für Admins (Stufe 1), für externe Logins (Stufe 2) sowieso.
- **Senior-Entwickler-Review** ist Pflicht, bevor KI-generierter Code in einen Release-Branch geht (Lizenz-/Prompt-Injection-/Snippet-Risiko).
- **Keine Klarpasswörter**, Argon2id oder vergleichbar.
- **Code-Experimente** mit Claude in isolierter VM, nicht direkt auf Tims Arbeitsrechner.

## 11. Offene Punkte

| # | Thema | Wer | Wann | Status |
|---|-------|-----|------|--------|
| 1 | Budget-Rahmen Joachim | Joachim | nach 3. Demo (mit erweitertem Mockup) | offen |
| 2 | **Schartec-Klärung:** Können die ~2.000 Störungscodes als Excel exportiert werden? | Joachim | parallel | offen — aus 2. Termin |
| 3 | Pilot-Objekt für Stufe 1 | Joachim | vor Stufe-1-Start | offen |
| 4 | Hosting-Entscheidung (EU-Cloud vs. On-Premise) | Tim, mit Joachim | Stufe-1-Start | offen |
| 5 | Backend-Sprache final (Fastify vs. FastAPI) | Tim mit Senior-Entwickler | nach Tech-Spec | offen |
| 6 | Bereitschaftsdienst-Logik in Priorisierungsregeln | Joachim + Tim | Stufe 1 | offen |
| 7 | Aufwandsschätzung gegen erweiterten Mockup-Scope abgleichen | Tim mit Senior-Entwickler | nach Mockup-Stand 2026-05-XX | offen |
| 8 | **Office-365-Integration konkret:** `mailto:`-Trigger oder Graph-API-Direktversand für Stufe 1? | Tim mit Senior-Entwickler | bei Tech-Spec | offen — aus 2. Termin |
| 9 | **Tickettyp-Felder finalisieren:** welche Pflichtfelder bei Wartung / Reparatur / Baubegehung? | Tim mit Joachim | bei 3. Demo | offen — aus 2. Termin |
| 10 | **Wiederholungsmuster für Wartungen:** reicht einmalig/jährlich/halbjährlich/quartal oder braucht's Cron-artige Regeln? | Tim mit Joachim | bei 3. Demo | offen |
| 11 | **Mehrpersonen-Geschäftspartner** (Ehepaar, Erbengemeinschaft, GbR): Erweiterung Partner-Datenmodell um mehrere Personen pro Eintrag — Stufe 1 oder Stufe 2? | Tim mit Joachim | Stufe-1-Spezifikation | offen — aus 3. Konzept-Abgleich |
| 12 | **Skalierbare Mieter/Eigentümer-Auswahl:** Umstieg von Checkbox-Liste auf Search-Dropdown ab welchem Volumen? | Tim mit Senior-Entwickler | bei Tech-Spec | offen — aus 3. Konzept-Abgleich |
| 13 | **Strukturierte Adressfelder als eigene Entität:** ✅ im Mockup umgesetzt (Sidebar-Eintrag „Adressen", AdressModal mit Straße/Hausnr/Adresszusatz/PLZ/Ort/Land/Bemerkung, AdressCombobox mit Inline-Anlegen, Wiederverwendung über Objekt/Haus/Partner). In Stufe 1 als echte Tabelle mit Validierung (PLZ-Plausibilität, Geokodierung optional). | Tim, Joachim, Senior-Entwickler | bei Tech-Spec | im Mockup gelöst — Stufe 1 verfeinert |

## 12. Vorgehen — aktueller Stand

**Erledigt:**
- ✅ Stufe 0 Mockup mit Joachim besprochen (1. Termin im April, 2. Termin am 13.05.2026)
- ✅ Konzept v3 (dieses Dokument) auf Basis 2. Termin
- ✅ EBO + KI nach Stufe 2 verschoben
- ✅ PWA, Chat, Notifications, Wartet-auf-Status, Kanban, Multi-Foto+Annotationen, Bearbeiter-Select — im Mockup live

**Als Nächstes (in Reihenfolge):**

1. **Mockup-Erweiterung 2.0** (Stufe-0-Erweiterung vor 3. Joachim-Demo) — siehe Tasks-Liste in `02_draft/fm-stoerungen/CLAUDE.md`:
   - ✅ Joachims Namen korrigieren (Brendel → Löffler in allen Demo-Daten) — erledigt 2026-05-18
   - Objektverwaltung vierstufig: Objekt → Haus → Stockwerk → Einheit (Haus- und Einheit-Ebene dynamisch sichtbar). Haus mit eigener Adresse, Stockwerk mit Grundriss-Upload, Pin pro Ticket auf dem Grundriss.
   - Partner-Typ-Label „dienstleister" → „nachunternehmer"
   - Wartet-auf-Extern: konkretes Nachunternehmer-Feld + Kontakt-Pflicht
   - Tickettyp-Vorschau: Select „Tickettyp" oben (Reparatur/Wartung/Baubegehung), bei Wartung erscheint Fälligkeitsdatum-Feld
   - Projekt-Sammler (vereinfacht, als Vorschau)
2. **Tech-Spec für Senior-Entwickler** als strukturiertes Dokument schreiben (Tims Hausaufgabe aus dem 2. Termin):
   - Alle Stufe-1-Anforderungen aus diesem plan.md
   - Datenmodell mit Begründungen
   - Architektur-Skizze (PWA-Frontend, REST-API, Postgres, S3-kompatibles Foto-Storage, Auth)
   - Office-365-Integration-Optionen mit Trade-offs
   - Konfigurierbarkeits-Layer als zentrales Architektur-Prinzip
   - Soll als `02_draft/Tech_Spec_Stufe1_<DATUM>.md` entstehen
3. **3. Joachim-Demo** mit erweitertem Mockup — Aaron wieder mit dabei (Joachims Wunsch). Klicken durch die neuen Features, Feedback einholen.
4. **Aufwandsschätzung-Abgleich** mit Senior-Entwickler gegen den dann sichtbaren Scope. `Aufschlag_intern_*.docx` aktualisieren.
5. **Beauftragungsentscheidung** Joachim.
6. **Stufe-1-Start:** Datenmodell finalisieren → API-Spezifikation → Backend → Frontend gegen API → Auth → Pilot.

---

## Querverweise

- **Mockup:** [`02_draft/fm-stoerungen/`](../02_draft/fm-stoerungen/) — klickbarer React-Prototyp, Sub-`CLAUDE.md` enthält technische Hinweise. PWA-fähig, online deployable via Netlify Drop.
- **Mockup-Build (Stufe 0, deployable):** [`03_output/fm-stoerungen-mockup-2026-05-06.zip`](../03_output/fm-stoerungen-mockup-2026-05-06.zip) — Production-Build, für Netlify Drop. Mail-Vorlage an Joachim: [`03_output/Email_Mockup_Joachim_2026-05-06.md`](../03_output/Email_Mockup_Joachim_2026-05-06.md).
- **Aufwandsschätzung (intern):** [`01_plan/Aufschlag_intern_Ticketsystem_2026-04-27.docx`](Aufschlag_intern_Ticketsystem_2026-04-27.docx) — bleibt unverändert (interner Stand). Nach Mockup-Erweiterung gegen aktuellen Scope abgleichen.
- **Übergabe-Dokument:** [`01_plan/Uebergabe_Kollege_Ticketsystem_2026-04-27.md`](Uebergabe_Kollege_Ticketsystem_2026-04-27.md) — Briefing für Senior-Entwickler. Wird im nächsten Schritt durch Tech-Spec ersetzt.
- **Transkripte:**
  - 1. Joachim-Termin (April): [`00_input/Abstimmung zu Claude Ticketsystem.vtt`](../00_input/Abstimmung%20zu%20Claude%20Ticketsystem.vtt)
  - 2. Joachim-Termin (13.05.2026): [`00_input/13.05.2026 Austausch Ticketsystem .vtt`](../00_input/13.05.2026%20Austausch%20Ticketsystem%20.vtt) — Grundlage dieser v3
- **Vorgängerstand:** [`01_plan/plan_v1_2026-04-24.md`](plan_v1_2026-04-24.md) — historisch.
- **Joachim-Deliverable (1. Termin):** [`03_output/Gespraechsprotokoll_Loeffler_Ticketsystem_2026-04-27.docx`](../03_output/Gespraechsprotokoll_Loeffler_Ticketsystem_2026-04-27.docx).
