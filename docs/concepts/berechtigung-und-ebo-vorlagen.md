# Konzept: Berechtigungskonzept + EBO-Vorlagen (Fehlercodes als Standardtickets)

**Projekt:** 08_FM_ERP_app
**Stand:** 2026-05-19
**Bezug:** ergänzt [`plan.md`](plan.md) — präzisiert Abschnitt 5.4 (Rollen & Rechte) und Abschnitt 6 (Stufe 2 — EBO-Anbindung + Schartec-Störungscode-Import)

> **Entscheidung Tim 2026-05-19:**
> - **Teil A (Berechtigungskonzept) → Backlog.** Wird nicht jetzt umgesetzt. Im Mockup bleibt der einfache `istAdmin`-Pauschalcheck bestehen. Das vollständige RBAC-Modell aus diesem Dokument bleibt als Architektur-Referenz für Stufe 1/2 stehen.
> - **Teil B (EBO-Vorlagen) → umgesetzt im Mockup-Draft** als eigener Stammdatenbereich „Fehlercodes" mit ~20 Demo-Codes. Fehlercode-Feld in der Ticket-Anlegen-Maske mit Auto-Befüllung. Lösungstext-Sektion im Ticket-Detail nur für Admin-Rollen (Frau-Zwittich-Regel auch ohne RBAC bereits umgesetzt über `istAdmin`).
>
> Inhaltlich besteht der Konzeptrahmen weiter; Teil A wird wieder relevant, sobald externe Rollen (Mieter, Eigentümer, Nachunternehmer) anstehen.

> Zwei in sich abgeschlossene, aber miteinander verzahnte Konzepte:
> - **Teil A** legt fest, wer in welcher Stufe was darf — und wie das im Datenmodell und in der UI verankert wird, damit Stufe 2 (Mieter-Portal, externe Logins) ohne Refactoring andocken kann.
> - **Teil B** beschreibt, wie die ~2.000 EBO-Störungscodes aus Schartec als pflegbare Standardticket-Vorlagen ins System kommen, beim Eingang ein Ticket vorbefüllen und mit der Zeit zur Wissensbasis werden.
>
> Beide Themen begegnen sich an einer Stelle besonders deutlich: die **Frau-Zwittich-Regel** („Sonst wird die Arbeit zu stupide und die Jungs denken nicht mehr selber nach.") — sie ist im Berechtigungskonzept ein Sicht-Recht, in den EBO-Vorlagen ein Inhalts-Feld. Beide müssen zusammenpassen.

---

## Teil A — Berechtigungskonzept

### A.1 Ausgangslage

**Heutiger Stand im Mockup (`02_draft/fm-stoerungen/src/App.jsx`):**
- 2 aktive Rollen in `ROLLEN`: `admin`, `techniker`.
- Pauschal-Check `const istAdmin = user?.rolle === "admin"` schaltet ganze Bereiche an/aus (Stammdaten, Vorlagen, Adressen, Benutzer, Auswahllisten, Reporting).
- plan.md Abschnitt 5.4 sieht eine 3. Rolle „Büro" vor — im Mockup nicht aktiv, weil Joachim im 2. Termin gesagt hat „2 Rollen reichen, keep it simple".
- Im Code gibt es bereits **system-Rollen für Status-Werte** (`STATUS_ROLLEN`) — das sind aber **Workflow-Klassifikationen** (`eingang`, `bearbeitung`, `wartend`, `abgeschlossen`), nicht **Benutzer-Berechtigungs-Rollen**. Beide Konzepte verwechseln sich leicht — im Datenmodell sauber trennen.

**Probleme mit dem heutigen Pauschal-Check:**

1. **Granularität fehlt.** Techniker dürfen heute keine Stammdaten lesen, in der Realität brauchen sie aber z. B. die Mieter-Telefonnummer im Ticket. Heute funktioniert das nur, weil das Mockup-Ticket die Daten redundant mitträgt. Im Produktivsystem mit referenzierten Stammdaten geht das nicht mehr.
2. **Stufe-2-fähig?** Mieter-Portal, Bereitschaft, Hausverwalter, Nachunternehmer — diese Rollen lassen sich mit einem Bool nicht abbilden.
3. **Konfigurierbarkeit.** plan.md Abschnitt 5.13 fordert „möglichst flexibel, konfigurativ statt programmiert". Hartcodierte Rollen widersprechen diesem Grundsatz.
4. **Audit-Tauglichkeit.** Wer hat wann mit welcher Rolle was geändert? Heute steht im Verlauf nur der Benutzer, nicht das Recht, mit dem er es durfte. Wenn ein Benutzer später eine andere Rolle bekommt, ist die alte Aktion nicht mehr nachvollziehbar.

**Ziele dieses Konzepts:**

| # | Ziel | Stufe |
|---|------|:----:|
| 1 | Stufe 1 funktioniert mit 2 Rollen (Admin, Techniker), Büro als Option vorbereitet, ohne dass die UI komplexer wirkt | 1 |
| 2 | Berechtigungs-Logik abstrahiert (kein `if istAdmin` mehr im UI-Code, sondern `if rechte.darf("stammdaten.lesen")`) | 1 |
| 3 | Datenmodell so, dass beliebig viele Rollen mit feingranularen Rechten ohne Schema-Migration ergänzt werden können | 1 |
| 4 | Mieter-Portal, Bereitschaft, externe Auftraggeber, Mehrobjekt-Mandanten in Stufe 2 als zusätzliche Rollen ohne Code-Eingriff | 2 |
| 5 | Audit-Log enthält neben User auch die wirksame Rolle | 1 |
| 6 | Admin kann Rollen-Rechte über eine Admin-UI anpassen (im Rahmen einer Default-Matrix) | 2 |

### A.2 Modell — RBAC mit Bereichen, Aktionen, Scope

**Begriffe:**

- **Benutzer** — eine Person mit Login (heute: Mitarbeiter; später: Mieter, Externe).
- **Rolle** — ein benannter Satz von Rechten (Admin, Techniker, Büro, später Mieter, Bereitschaft, Nachunternehmer, …). Jeder Benutzer hat **genau eine** Rolle in Stufe 1; Mehrfach-Rollen (z. B. „Admin + Bereitschaft") sind Stufe 2.
- **Bereich** — ein logischer Abschnitt der App (`tickets`, `stammdaten.partner`, `stammdaten.objekte`, `stammdaten.adressen`, `stammdaten.benutzer`, `vorlagen`, `auswahllisten`, `ebo_codes`, `reporting`, `einstellungen`, `audit`).
- **Aktion** — eine atomare Operation pro Bereich (`lesen`, `anlegen`, `bearbeiten`, `loeschen`, `zuweisen`, `bulk_edit`, `export`, `import`, …).
- **Recht** = Kombination `bereich.aktion` (z. B. `tickets.zuweisen`, `stammdaten.partner.bearbeiten`).
- **Scope** — Einschränkung, *worauf* das Recht wirkt: `alle`, `eigene`, `objekt:<id>`, `mandant:<id>`. Stufe 1 reicht der Wechsel zwischen `alle` und `eigene`.

**Beispiel — die Rechte eines Technikers (Auszug):**
```
tickets.lesen           scope: alle      # Pool sieht jeder Techniker (Übergabe, Vertretung)
tickets.bearbeiten      scope: eigene    # nur eigene zugewiesene Tickets bearbeiten
tickets.kommentar       scope: alle      # darf in jedem Ticket mitschreiben
tickets.foto            scope: alle      # darf in jedem Ticket Foto hochladen
stammdaten.partner.lesen scope: alle     # zur Kontaktauflösung (Telefon des Mieters)
stammdaten.partner.bearbeiten           # NEIN
stammdaten.benutzer.*                    # NEIN
vorlagen.*                               # NEIN
ebo_codes.lesen          scope: alle    # darf Titel/Beschreibung sehen
ebo_codes.lesen.loesung                 # NEIN (Frau-Zwittich-Regel)
```

Die vollständige Default-Matrix steht in Abschnitt A.5.

### A.3 Stufe-1-Rollen

Drei Rollen werden mitgeliefert. Büro ist als Default **deaktiviert** (in der Tabelle vorhanden, `aktiv=false`), damit Joachim sie jederzeit aktivieren kann ohne Datenmigration.

| Rolle | Sichtbar in UI Stufe 1 | Kerngedanke |
|-------|:----:|-------------|
| `admin` | ✅ | Voller Zugriff: Stammdaten- und Benutzer-Pflege, Reporting, Konfiguration |
| `techniker` | ✅ | Mobile Bearbeitung eigener Tickets, lesender Zugriff auf Stammdaten zur Kontaktauflösung |
| `buero` | optional (deaktiviert) | Tickets erfassen + Status nachpflegen, keine Stammdaten-/Benutzer-Verwaltung |

### A.4 Stufe-2-Rollen (vorbereitet, nicht aktiv in Stufe 1)

| Rolle | Was sie tut | Zusatz-Mechanik |
|-------|-------------|-----------------|
| `mieter` | externer Login, sieht nur Tickets, die er selbst gemeldet hat; moderierter Kommentar-Strang | Scope: `eigene` mit Filter `melder.partner_id == user.partner_id` |
| `eigentuemer` | externer Login, sieht alle Tickets seiner Objekte, Reporting-Auszüge | Scope: `objekt:<id>` über `objekt_partner`-Tabelle |
| `bereitschaft` | wie Techniker, plus Sonderrecht „Nachtfilter umgehen", „aus EBO direkt akzeptieren" | Bereitschafts-Zeitfenster am Benutzer |
| `nachunternehmer` | externer Login, sieht nur Tickets, in denen sein Partner als `wartet_nachunternehmer_id` gesetzt ist | Scope: `eigene` mit Filter über Nachunternehmer-Referenz |
| `mandant_admin` | wie Admin, begrenzt auf einen `mandant_id` | Scope: `mandant:<id>` über alle Bereiche |

Alle diese Rollen liegen in der `rolle`-Tabelle bereit, `aktiv=false`, mit sinnvollen Default-Rechte-Sets. Der Code prüft **immer** gegen `rolle.rechte`, nie gegen Rollen-Namen — das macht Stufe 2 zur Konfig-Aufgabe statt zur Code-Änderung.

### A.5 Default-Rechte-Matrix

Single Source of Truth für Stufe 1. Cell-Format: `✓` = vollumfänglich, `✓ eigene` = Scope-eingeschränkt, `–` = kein Recht.

| Bereich | Aktion | Admin | Techniker | Büro |
|---------|--------|:-----:|:---------:|:----:|
| Tickets | lesen | ✓ alle | ✓ alle | ✓ alle |
| Tickets | anlegen | ✓ | ✓ | ✓ |
| Tickets | bearbeiten | ✓ alle | ✓ eigene | ✓ alle |
| Tickets | löschen | ✓ | – | – |
| Tickets | zuweisen | ✓ | – | ✓ |
| Tickets | bulk_edit | ✓ | – | – |
| Tickets | export | ✓ | – | ✓ |
| Tickets | kommentar | ✓ | ✓ | ✓ |
| Tickets | foto | ✓ | ✓ | ✓ |
| Stammdaten/Partner | lesen | ✓ | ✓ | ✓ |
| Stammdaten/Partner | bearbeiten | ✓ | – | – |
| Stammdaten/Objekte | lesen | ✓ | ✓ | ✓ |
| Stammdaten/Objekte | bearbeiten | ✓ | – | – |
| Stammdaten/Adressen | lesen | ✓ | ✓ | ✓ |
| Stammdaten/Adressen | bearbeiten | ✓ | – | – |
| Stammdaten/Benutzer | lesen | ✓ | – | – |
| Stammdaten/Benutzer | bearbeiten | ✓ | – | – |
| Vorlagen (Tickettypen) | lesen | ✓ | ✓ | ✓ |
| Vorlagen (Tickettypen) | bearbeiten | ✓ | – | – |
| Auswahllisten | lesen | ✓ | ✓ | ✓ |
| Auswahllisten | bearbeiten | ✓ | – | – |
| **EBO-Codes** | **lesen** | ✓ | ✓ (Titel/Beschreibung) | ✓ |
| **EBO-Codes** | **lesen.loesung** | ✓ | **–** (Frau-Zwittich-Regel) | ✓ |
| EBO-Codes | bearbeiten | ✓ | – | – |
| EBO-Codes | import | ✓ | – | – |
| Reporting | lesen | ✓ | (eigene Kennzahlen) | ✓ |
| Reporting | ki_loesungen (Stufe 2) | ✓ | – | – |
| Einstellungen | bearbeiten | ✓ | – | – |
| Audit-Log | lesen | ✓ | – | – |

**Anmerkungen:**
- **Bulk-Edit** ist nur Admin, weil Techniker sowieso scope-eingeschränkt sind und Bulk-Aktionen über fremde Tickets nicht sinnvoll wären.
- **Zuweisen** kann auch Büro — sonst säße Büro beim Telefonat fest, ohne das Ticket weiterreichen zu können.
- **EBO-Codes lesen.loesung** ist das einzige Recht, das innerhalb eines Bereichs noch einmal feiner ist (Sub-Recht). Mechanisch identisch zu einem normalen Recht; nur dokumentarisch hervorgehoben, weil es Frau Zwittichs explizites Veto kodifiziert.

### A.6 UI-Umsetzung in Stufe 1

**Heutige Code-Stelle (`App.jsx:920`):**
```js
const istAdmin = user?.rolle === "admin";
```
**Wird ersetzt durch:**
```js
const rechte = useRechte();  // Hook liefert {darf, rolle, bereich}
if (rechte.darf("stammdaten.benutzer.bearbeiten")) { … }
```

**Helper-API-Skizze:**
- `rechte.darf(rechtPfad, ressource?)` — boolean. `ressource?` optional, prüft Scope. Beispiel: `rechte.darf("tickets.bearbeiten", ticket)` → `true` wenn Admin (Scope `alle`); `ticket.zugewiesen_user_id === user.id` wenn Techniker (Scope `eigene`).
- `rechte.rolle` — der Rolle-Datensatz, falls noch feinere Logik gebraucht wird.
- `rechte.bereich(bereichPfad)` — liefert die effektiven Aktionen im Bereich (für Listen-Filter wie „welche Sidebar-Einträge zeigen?").

**Sidebar / Navigation:**
- Jeder Sidebar-Eintrag bekommt eine `bereich`-Annotation (`{ id: "benutzer", bereich: "stammdaten.benutzer" }`).
- Beim Rendern filtert die Sidebar nach `rechte.darf("<bereich>.lesen")`.
- **Keine `istAdmin`-Konditionalketten im UI-Code mehr.**

**Bulk-Edit / Power-Layout (Memory `power-layout-listen`):**
- Pencil-Icon im Spalten-Header erscheint nur, wenn `rechte.darf("<bereich>.bulk_edit")`.
- Bulk-Edit-Dropdowns prüfen das jeweilige Bearbeiten-Recht serverseitig erneut — UI-Hide ist Bequemlichkeit, nicht Sicherheit.

**Detail-Ansicht eines Tickets (für Techniker bei fremden Tickets):**
- Wenn `rechte.darf("tickets.bearbeiten", ticket) === false` → Detail wird im **Lesemodus** angezeigt:
  - Alle Edit-Felder ausgegraut.
  - Banner oben: „Nur lesen — Ticket ist [Name] zugewiesen."
  - Kommentare/Fotos bleiben editierbar (eigenes Recht `tickets.kommentar`, `tickets.foto`).

### A.7 Datenmodell-Erweiterung

Ergänzt das Datenmodell aus plan.md Abschnitt 9.

```sql
rolle
  id (string, PK)                    -- z.B. "admin", "techniker", "buero"
  label, beschreibung
  aktiv (bool)                       -- Stufe 1: admin, techniker = true; buero & Stufe-2-Rollen = false
  ist_system (bool)                  -- System-Rollen können nicht gelöscht werden
  reihenfolge (int)

recht
  id (string, PK)                    -- z.B. "tickets.bearbeiten"
  bereich (string)                   -- z.B. "tickets"
  aktion (string)                    -- z.B. "bearbeiten"
  label, beschreibung
  unterstuetzt_scope (string[])      -- z.B. ["alle", "eigene"], oder null wenn nicht scope-fähig

rolle_recht
  rolle_id → rolle
  recht_id → recht
  scope (string, default "alle")     -- "alle" | "eigene" | "objekt:<id>" | "mandant:<id>"
  PRIMARY KEY (rolle_id, recht_id)

benutzer
  ... (wie heute) plus
  rolle_id → rolle                   -- ersetzt das Freitext-Feld "rolle"
  -- mandant_id ist im Datenmodell schon vorgesehen (plan.md 9), für Stufe-2-Rollen.

-- Audit-Erweiterung
ticket_verlauf       (wie heute) plus aktor_rolle_id → rolle
system_audit         (neu, falls noch nicht da) — alle Schreibvorgänge plus aktor_rolle_id
```

**Audit-Log mit Rolle:** Wenn ein User später eine andere Rolle bekommt, bleibt der historische Datensatz nachvollziehbar („damals war er Techniker, jetzt ist er Büro").

**Migration aus heutigem Mockup:**
- Die `ROLLEN`-Konstante mit `id: "admin"` / `id: "techniker"` mappt 1:1 auf die neue `rolle`-Tabelle.
- Die im Mockup hartcodierten Rechte werden zu Default-Einträgen in `rolle_recht`.
- `benutzer.rolle` (heute String) → `benutzer.rolle_id` (FK) — einfache Migration über String-Match.

### A.8 Offene Punkte / Abstimmungsbedarf

1. **Soll „Büro" in Stufe 1 mitgeliefert werden, auch wenn deaktiviert?** — Vorschlag: ja. Aufwand minimal, Joachim kann sie jederzeit aktivieren ohne Re-Deployment.
2. **Bereich `reporting` für Techniker:** Welche Berichte sind das überhaupt? Wahrscheinlich nur „Wieviele eigene Tickets sind diese Woche zu erledigen" — kein eigenes Modul, nur Dashboard-Tiles. Mit Joachim final klären.
3. **Rechte-Editor-UI Stufe 1 oder Stufe 2?** — Vorschlag: Stufe 1 = nur read-only Anzeige der Default-Matrix (Joachim soll *sehen*, was Techniker dürfen); Stufe 2 = Editor mit Custom-Rollen. Bei 10 MA reicht's, wenn Tim die Matrix einmalig pflegt.
4. **Bereitschafts-Dienst Stufe 1 oder Stufe 2?** — plan.md OP #6 (offen). Vorschlag: Stufe 1 als Flag am Benutzer (`ist_bereitschaft: bool` + Zeitfenster), keine eigene Rolle. Echte Bereitschafts-Rolle erst Stufe 2 mit EBO-Live-Anbindung.
5. **Mehrere Rollen je Benutzer?** — Stufe 1 nicht. Datenmodell-Frage: jetzt schon n:m (`benutzer_rolle`) anlegen oder erst migrieren, wenn's gebraucht wird? Vorschlag: jetzt schon n:m, Aufwand identisch.
6. **Wie sieht der Techniker den Mieter-Kontakt im Ticket?** — Sektion „Beteiligte" zeigt Name + Telefon + Mail, aus Stammdaten geholt, nicht im Ticket gespeichert. Damit greift `stammdaten.partner.lesen` und der Techniker sieht's, ohne dass das Ticket Stammdaten redundant trägt.

---

## Teil B — EBO-Vorlagen (Fehlercodes als Standardtickets)

### B.1 Ausgangslage

**EBO (EcoStruxure Building Operation) Realität:**
- Schneider Electric-System, **Schartec** ist Joachims Vertragspartner.
- ~2.000 Störungscodes hinterlegt, jeder Code beschreibt einen typischen Fehlerfall (z. B. „Filter verschmutzt", „Differenzdruck zu hoch", „Brandmelde-Linie Störung").
- Heutiger Workflow ohne System: EBO ruft Bereitschaft → Bereitschaft googelt / erinnert sich, was Code XY bedeutet → Techniker fährt los.
- Schartec-Klärung läuft (plan.md OP #2): Können die Codes als Excel exportiert werden?

**Joachims O-Ton (2. Termin):** „Möglichst flexibel, dass man nicht neu programmieren muss, sondern alles konfigurativ lösen kann." Plus Tim: „Wenn du immer alles hast von allen möglichen Ticketvarianten, dann wird es ein riesiges Formular und keiner findet sich mehr zurecht."

**Vision (in 1 Satz):** Eine **EBO-Vorlage** ist ein vorgefertigter Ticket-Baustein. Sobald ein Code reinkommt — manuell oder später automatisch — wird das Ticket aus der Vorlage hydratisiert (Titel, Kategorie, Priorität, Standard-Beschreibung, Anlage, Lösungsweg-Hinweis). Der Bearbeiter spart 30–60 Sekunden pro Eingang **und** macht es jedes Mal richtig.

### B.2 Was ist eine EBO-Vorlage?

Eine EBO-Vorlage ist ein Stammdatensatz mit folgenden Feldern:

| Feld | Pflicht | Beispiel | Was es im Ticket macht |
|------|:-------:|----------|------------------------|
| `code` | ✅ | `EBO-3471` | Wird im Ticket als `ebo_code_id` referenziert |
| `titel` | ✅ | „RLT Klima Süd — Filter verschmutzt" | Vorbefüllt `ticket.titel` |
| `bereich` (`kategorie_id`) | ✅ | `klima` | Mapped auf `ticket.kategorie_id` |
| `prioritaet_default` | ✅ | `P3` | Vorbefüllt `ticket.prio_id`, **überschreibbar** |
| `tickettyp_default` | ✅ | `reparatur` | Vorbefüllt `ticket.tickettyp_id` |
| `beschreibung_text` | opt. | „Filter verschmutzt, Differenzdruck > 250 Pa. Filter wechseln, Druckanzeige zurücksetzen." | Vorbefüllt `ticket.beschreibung` |
| `loesung_text` | opt. | „1. Filter ausbauen, Marke F7 580×580×96 mm. 2. Differenzdruck zurücksetzen über Touchpanel → Service → Reset DP." | **Nur Admin/Büro sichtbar** (Frau-Zwittich-Regel) — gesonderte Sektion im Ticket, siehe B.4 |
| `wartet_grund_default` | opt. | `wartet-material` | Falls Code typischerweise auf Material wartet |
| `anlage` | opt. | „RLT Klima Süd" | Vorbefüllt `ticket.anlage` |
| `objekt_id` | opt. | — | Falls Code objekt-spezifisch ist (selten — meist gewerke-bezogen) |
| `tags` | opt. | `["nacht", "bereitschaft"]` | Filter-/Suchhilfe |
| `quelle` | ✅ | `schartec_import_2026-05-19` | Welcher Schartec-Import diesen Code geliefert hat |
| `aktiv` | ✅ | `true` | Inaktive Codes verschwinden aus dem Eingangs-Workflow, bleiben für Audit-Querverweise |
| `nutzung_count` | ✅ (system) | 47 | Wie oft wurde ein Ticket aus dieser Vorlage erzeugt? |
| `letzte_nutzung_am` | opt. (system) | 2026-05-12 | Pflegt sich selbst |

EBO-Vorlagen leben in einem **neuen Sidebar-Eintrag „EBO-Codes"** (unter „Vorlagen", über „Auswahllisten"). Nur sichtbar für Rollen mit `ebo_codes.lesen` (Admin und Büro in der Default-Matrix).

### B.3 Import-Workflow (Schartec → System)

**Stufe 1:** Excel-Import (XLSX/CSV). **Stufe 2:** Live-API.

**UI-Flow für Excel-Import:**

1. Admin öffnet „EBO-Codes" → Button „Import aus Schartec-Excel".
2. Datei-Upload (XLSX). System parst Spalten.
3. **Mapping-Schritt** — UI zeigt erkannte Spaltenköpfe und lässt Admin auf Zielfelder mappen:
   ```
   Schartec-Spalte           →   System-Feld
   "Code"                    →   code
   "Beschreibung"            →   titel
   "Anlage"                  →   anlage
   "Gewerk"                  →   bereich
   "Empfohlene Maßnahme"     →   loesung_text
   "Priorität"               →   prioritaet_default
   ```
   Mapping wird gespeichert (`fm-ebo-import-mapping`-Profil), beim nächsten Import vorausgewählt.
4. **Vorschau** — Tabelle zeigt erkannten Inhalt, hebt Duplikate (`code` bereits vorhanden) und Konflikte (z. B. Titel weicht ab) hervor.
5. **Konflikt-Lösung pro Code:** Behalten / Überschreiben / Übernehmen (neu).
6. **Bestätigung** → Bulk-Insert + Audit-Eintrag „Schartec-Import 2026-05-19 — 1.984 neu, 16 aktualisiert, 0 gelöscht".

**Wichtig:** Der Import **löscht nichts**. Codes, die nicht mehr in der neuen Excel sind, werden auf `aktiv=false` gesetzt (mit Hinweis im Audit), bleiben aber im System — wegen Audit-Querverweisen von Tickets, die diesen Code mal genutzt haben.

**Stufe 2 — Live-API:**
- OPC-UA-Subscription oder REST-Polling gegen die Schartec/EBO-API.
- Code-Updates automatisch importieren (mit Konflikt-Strategie aus Default-Mapping).
- Tickets entstehen automatisch im Status `neu`, wenn ein EBO-Event eintritt (gefiltert durch den KI-Layer aus plan.md Abschnitt 6).

### B.4 Hydratation: EBO-Code → Ticket

**Manuelle Erfassung (Stufe 1):**
- Im Ticket-Anlegen-Modal gibt es ein Feld **„EBO-Code"** (Autocomplete-Suche über `code`, `titel`, `bereich`).
- Auswahl → alle Felder der Vorlage werden ins Formular vorbefüllt.
- Erfasser kann jedes Feld überschreiben.
- Beim Speichern: `ticket.ebo_code_id` wird gesetzt, plus ein **Snapshot** der Vorlage (`ticket.ebo_code_snapshot`, JSONB) — damit der Ticket-Kontext auch dann nachvollziehbar bleibt, wenn die Vorlage später geändert wird.
- Audit-Eintrag „Erstellt aus EBO-Vorlage EBO-3471".

**Automatische Erfassung (Stufe 2):**
- EBO-Event kommt rein → System schlägt Vorlage über `code` nach → Ticket wird im Status `neu` erstellt, alle Felder vorbefüllt.
- Wenn der Code unbekannt ist: Ticket wird trotzdem angelegt (mit Default-Vorlage `EBO-UNBEKANNT`), Admin bekommt Notification „Neuer unbekannter EBO-Code — Vorlage pflegen?".

**Lösungstext-Sichtbarkeit (Frau-Zwittich-Regel, plan.md Abschnitt 2):**

Im Ticket-Detail erscheint die Standard-Lösung als gesonderte Sektion **„Lösungshinweis aus EBO-Vorlage"**:

- **Admin / Büro** (`ebo_codes.lesen.loesung = true`): Sektion ist offen, voller Text sichtbar, mit Quellangabe „aus EBO-3471".
- **Techniker** (`ebo_codes.lesen.loesung = false`): Sektion ist **nicht da**. Stattdessen kleiner Button „Lösungshinweis vom Admin anfordern" → erzeugt Chat-Eintrag „[Techniker-Name] hat um Lösungshinweis gebeten" + Notification an alle Admins. Admin kann dann gezielt entscheiden, was er weitergibt.

Das setzt Frau Zwittichs Anforderung wörtlich um: „Sonst wird die Arbeit zu stupide und die Jungs denken nicht mehr selber nach."

**Anmerkung:** Auch die Techniker-Sicht zeigt, dass das Ticket aus einem EBO-Code stammt (kleines Pill `EBO-3471` im Header) — nur der **Lösungsweg** ist verborgen, nicht die EBO-Herkunft an sich.

### B.5 EBO-Code-Pflege im Alltag (Lern-Loop)

Pflegt sich nicht selbst — aber der Pflege-Aufwand bleibt klein, weil Lernen aus echten Tickets organisch entsteht:

- Wenn ein Admin ein Ticket aus einer EBO-Vorlage abschließt und im Ticket-Verlauf einen besseren Lösungsweg notiert hat („Schmierfeststellung war Hauptursache, Riemen war es nicht"), erscheint nach Ticket-Abschluss ein Button **„Lösung in EBO-Vorlage übernehmen"** → öffnet die Vorlage in einem Diff-Modal, zeigt aktuelle vs. neue Lösung nebeneinander, Admin entscheidet (Behalten / Überschreiben / Anhängen).
- So wächst die Wissensbasis ohne separates Wartungs-Modul. Häufig genutzte Codes haben die besten Lösungen, weil sie am meisten verfeinert wurden.

**Verknüpfung zur KI (Stufe 2, plan.md Abschnitt 6):**
- Ähnliche-Tickets-Suche per Embeddings nutzt EBO-Code als zusätzliche Feature-Dimension.
- KI-Lösungsvorschläge ziehen primär aus dem `loesung_text` der EBO-Vorlage, sekundär aus dem Verlauf ähnlicher abgeschlossener Tickets.
- Beides bleibt **Admin-only** (siehe Berechtigungs-Matrix `reporting.ki_loesungen`) — Frau Zwittichs Veto wirkt auch hier.

### B.6 Datenmodell-Skizze

```sql
ebo_code  -- die EBO-Vorlage
  id (string, PK)                    -- z.B. "EBO-3471"
  code (string, unique)              -- Roh-Code aus Schartec
  titel (string)
  kategorie_id → kategorie           -- Bereich/Gewerk
  prioritaet_default → prioritaet
  tickettyp_default → tickettyp
  beschreibung_text (text, nullable)
  loesung_text (text, nullable)
  wartet_grund_default → wartet_grund (nullable)
  anlage (text, nullable)
  objekt_id → objekt (nullable)      -- für objekt-spezifische Codes
  tags (string[], nullable)
  quelle (string)                    -- z.B. "schartec_import_2026-05-19"
  aktiv (bool, default true)
  nutzung_count (int, default 0)
  letzte_nutzung_am (timestamp, nullable)
  erstellt_am, geaendert_am

ebo_import
  id, durchgefuehrt_von_user_id → benutzer
  durchgefuehrt_am
  quelle_datei_name
  neu_count, aktualisiert_count, deaktiviert_count
  mapping_snapshot (jsonb)            -- gespeichertes Mapping für Reproduzierbarkeit
  audit_zusammenfassung (text)

-- Ticket-Erweiterung
ticket
  ... (wie heute) plus
  ebo_code_id → ebo_code (nullable)   -- woher kam dieses Ticket?
  ebo_code_snapshot (jsonb, nullable) -- Vorlagen-Snapshot zum Zeitpunkt der Hydratation
```

**Warum der `ebo_code_snapshot`?** Wenn die Vorlage drei Monate später überarbeitet wird (Lösungstext verfeinert, Priorität geändert), darf das alte Ticket nicht plötzlich anders aussehen. Das Ticket trägt seinen Original-Kontext bei sich. Wer wissen will, was sich geändert hat, sieht's an `ebo_code` vs. `ebo_code_snapshot`.

### B.7 UI-Skizze

**Sidebar-Eintrag „EBO-Codes"** (über „Vorlagen", nur Admin/Büro):
- Liste mit **Power-Layout** (Memory-Konvention `power-layout-listen`): `fm-ebo-codes-layout`-Persistenz.
- Spalten (Default-Sichtbarkeit): `code`, `titel`, `bereich`, `prio_default`, `nutzung_count`, `letzte_nutzung_am`, `aktiv`.
- Filter pro Spalte: Multi-Select für `bereich`, `prio_default`, `aktiv`; Range für `nutzung_count`.
- Gruppierung typisch nach `bereich` (Klima, Heizung, …) oder `aktiv`.
- Sortierung Default: `nutzung_count DESC` (häufig genutzte oben).
- Bulk-Edit: `aktiv`, `bereich`, `prio_default`.
- Toolbar-Button „Import aus Schartec-Excel".
- Toolbar-Button „Code anlegen" (für manuelle Codes ohne Excel-Quelle, z. B. Eigen-Codes).

**Detailansicht eines EBO-Codes:**
- Felder im Edit-Layout (wie Partner/Objekt-Modale).
- Sektion **„Wo wird dieser Code verwendet?"** — Liste der Tickets mit `ebo_code_id == this.id`, gruppierbar nach Status/Jahr, click → öffnet Ticket.
- Sektion **„Import-Historie"** — letzte N `ebo_import`-Einträge, die diesen Code geliefert oder geändert haben.

**Auswirkungen auf andere Ansichten:**
- Ticket-Pool: neue optionale Spalte `EBO-Code` (Default ausgeblendet, einblendbar).
- Ticket-Detail: oben kleiner Pill `Quelle: EBO-3471`, falls aus EBO entstanden — sichtbar für alle.
- Ticket-Detail: Sektion „Lösungshinweis aus EBO-Vorlage" — nur für `ebo_codes.lesen.loesung`-berechtigte Rollen.

### B.8 Stufenmodell

| Stufe | Was | Umfang |
|-------|-----|--------|
| **Stufe 0 — Mockup** | UI-Mockup: EBO-Codes-Liste mit ~20 Demo-Codes (klima/heizung/elektro/sanitaer/aufzug), EBO-Code-Auswahl im Ticket-Anlegen-Modal, Ticket-Detail-Sektion „Standard-Lösung" mit Rollen-Sichtbarkeit (zeigt Frau-Zwittich-Regel live) | Vor der 3. Joachim-Demo umsetzbar |
| **Stufe 1 — MVP** | Voller Excel-Import-Workflow inkl. Mapping-Profile und Konflikt-UI, Lern-Loop „Lösung-aus-Ticket-übernehmen", Audit-Historie der Imports, Bulk-Edit, gespeicherte Ansichten | mit Stufe 1 |
| **Stufe 2** | Live-API gegen Schartec/EBO, KI-Cluster + Embeddings nutzen EBO-Code als Feature, Lösungsvorschläge im Admin-Seitenpanel, automatische Tickets aus EBO-Events mit Filter-Layer | mit Stufe 2 (gekoppelt an plan.md Abschnitt 6) |

### B.9 Offene Punkte / Abstimmungsbedarf

1. **Schartec-Excel-Verfügbarkeit** (plan.md OP #2) — läuft. Wenn negativ, bleibt das Konzept rein konzeptionell und Tim muss eine alternative Quelle finden (manuelle Top-100-Erfassung? Direkt-Anfrage an Schneider Electric?).
2. **EBO-Code-Realwerte** — Joachim hat bislang nichts Konkretes geliefert. Demo-Daten im Mockup wären erfundene Plausibel-Codes. Mit Joachim klären: kann er 10–20 echte Codes als Beispiel mitbringen?
3. **EBO-Code-Pflege in der Praxis** — werden alle ~2.000 Codes einmal manuell durchgepflegt (Lösungstext)? Oder nur die häufig genutzten? Vorschlag: Lern-Loop (B.5) reicht — nur die, die in der Praxis vorkommen, werden gepflegt.
4. **Mehrsprachigkeit** — Schartec liefert vermutlich Deutsch. Stufe 1 = Deutsch only. Stufe 2 mit Mieter-Portal ggf. Translation-Layer.
5. **EBO-Code-Versionierung** — was passiert, wenn Schartec einen Code ändert? Snapshot-Mechanismus (B.6) ist die Antwort. UX-Frage: Soll der Admin gewarnt werden („Code EBO-3471 hat sich geändert — bestehende Tickets verwenden noch alten Stand")? Vorschlag: Notification beim Import, kein lautes Modal.
6. **Lösungstext-Sichtbarkeit für Büro** — Vorschlag B.4 ist „Admin/Büro = ja, Techniker = nein". Frau Zwittichs Veto bezieht sich explizit auf Techniker. Mit Joachim final klären, ob Büro auch eingeschränkt sein soll.
7. **Wiederkehrende EBO-Codes als Wartungs-Tickets** — manche Codes sind wiederkehrend (Filter wechseln jedes Quartal). Vorschlag: `tickettyp_default = wartung` plus Wiederholungsmuster ist im Datenmodell schon vorbereitet. Konkrete Fälle mit Joachim sammeln.

---

## Querverknüpfung Berechtigung ↔ EBO-Vorlagen

| Frage | Antwort | Mechanik |
|-------|--------|----------|
| Wer pflegt EBO-Vorlagen? | Admin | `ebo_codes.bearbeiten` |
| Wer sieht den Standard-Lösungstext im Ticket? | Admin + Büro | `ebo_codes.lesen.loesung` |
| Wer darf den Schartec-Import auslösen? | Admin | `ebo_codes.import` |
| Wer sieht KI-Lösungsvorschläge (Stufe 2)? | Admin | `reporting.ki_loesungen` |
| Wer darf eine bessere Lösung aus einem Ticket zurück in die EBO-Vorlage spielen? | Admin | `ebo_codes.bearbeiten` (Lern-Loop-Modal nur sichtbar mit diesem Recht) |
| Wer sieht in der Ticket-Quelle, dass ein Ticket aus EBO kam? | alle (Admin, Techniker, Büro) | `tickets.lesen` — Herkunft ist nicht sensibel, nur die Lösung |
| Wer sieht in der Ticket-Liste die EBO-Code-Spalte? | alle, sofern sie die Spalte einblenden | UI-Konfiguration, keine Rechte-Frage |

**Der gemeinsame Nenner ist die Frau-Zwittich-Regel:** ein Inhalts-Feld (`loesung_text` in der EBO-Vorlage) wird über ein feines Recht (`ebo_codes.lesen.loesung`) für eine Rolle (Techniker) ausgeblendet. Dadurch bleibt der Lösungsweg im System (für Reporting, KI, Admin), wirkt aber nicht „stumpf machend" für den Techniker.

---

## Nächste Schritte (Vorschlag, abhängig von Tims Freigabe)

1. **Konzept prüfen** — Tim liest, gibt Feedback / Korrekturen / Freigabe-Signal. Offene Punkte aus A.8 und B.9 idealerweise direkt im Termin mit Joachim klären.
2. **Mockup-Erweiterung A — Berechtigung:**
   - `useRechte()`-Hook anlegen, `istAdmin`-Pauschalcheck überall ersetzen.
   - 3. Rolle „Büro" als Demo-User mit eingeschränkten Rechten.
   - Im Techniker-View Ticket-Detail mit Lesemodus-Banner bei fremden Tickets.
   - Optional: read-only Rechte-Übersicht im Admin-Bereich („So sieht der Techniker die App").
3. **Mockup-Erweiterung B — EBO-Vorlagen:**
   - Neuer Sidebar-Eintrag „EBO-Codes" (sichtbar für Rollen mit `ebo_codes.lesen`).
   - Liste mit ~20 plausiblen Demo-Codes (klima/heizung/elektro/sanitaer/aufzug), volles Power-Layout.
   - EBO-Code-Autocomplete in der Ticket-Anlegen-Maske → Vorbefüllung.
   - Ticket-Detail-Sektion „Standard-Lösung" mit Rollen-Sichtbarkeit (zeigt Frau-Zwittich-Regel live).
   - Lern-Loop-Modal als Demo (ohne echte Persistenz reicht).
4. **plan.md aktualisieren** — Abschnitt 5.4 (Rollen & Rechte) mit Verweis auf dieses Konzept, Abschnitt 6 (Stufe 2) mit Verweis auf die EBO-Vorlagen-Definition. Offene Punkte aus A.8 und B.9 in die OP-Liste plan.md Abschnitt 11 übernehmen.
5. **3. Joachim-Demo** mit beidem als Live-Klick-Strecke. Demo-Story: Wechsel User Admin↔Techniker, Erfassung eines Tickets aus einem EBO-Code, Lösungshinweis-Sichtbarkeit pro Rolle.

---

*Sobald Tim Freigabe gibt, gehen die beiden Mockup-Erweiterungen unter `02_draft/fm-stoerungen/` los. Bis dahin: kein Code.*
