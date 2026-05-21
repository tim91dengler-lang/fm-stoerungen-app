# Konzept: KI-First-Architektur (LLM als zentraler Layer)

**Projekt:** 08_FM_ERP_app
**Stand:** 2026-05-19
**Status:** Entwurf zur Prüfung durch Tim — noch nicht freigegeben
**Bezug:** verschiebt [`plan.md`](plan.md) Abschnitt 6 (KI als „Stufe-2-Erweiterung") in Richtung **KI als Architektur-Prinzip von Anfang an**. Ergänzt das bestehende [Berechtigungs-/EBO-Konzept](Konzept_Berechtigung_und_EBO_Vorlagen_2026-05-19.md) — die EBO-Vorlagen werden mit KI zu einer aktiven Wissensbasis.

> Dieses Konzept ändert die Reihenfolge des bisherigen Stufenmodells **nicht** rückwirkend, aber den **Bauplan**: KI wird nicht als nachgelagertes Modul gebaut, sondern als Layer durch alles. Das hat Konsequenzen für Datenmodell, Architektur und UX bereits in Stufe 1.

---

## 1. Was „KI-First" hier bedeutet (und was nicht)

**KI-First heißt:**

1. **KI ist ein Layer, kein Feature.** Es gibt keinen „KI-Bereich" in der Sidebar — sondern KI ist in jeder relevanten Stelle eingewoben: Eingangs-Triage, Klassifizierung, Suche, Reporting, Pflege der Fehlercode-Wissensbasis. User merken es als „die App weiß mit", nicht als „ich klicke jetzt auf KI".
2. **Always-On-Copilot, kein Chatbot-Beiwerk.** In jedem View ist ein Assistant-Slot eingebaut — entweder als Side-Panel, als Inline-Vorschlag oder als Command-Palette mit Natural-Language-Eingabe. Der Slot ist immer da; ob er gefüllt ist, hängt vom Kontext ab.
3. **Datenmodell ist KI-ready ab Tag 1.** Jedes Ticket bekommt von Anfang an einen Embedding-Vektor, jede Fehlercode-Vorlage auch. Auch wenn Stufe 1 die Embeddings nur intern für Suche nutzt, wandert das Modell nicht später hinterher.
4. **Vertrauensschicht ist Pflicht, nicht Kür.** Confidence, Quelle, „Warum?"-Button, Akzeptieren/Ablehnen, Audit-Log für KI-Aktionen — alles von Anfang an Bestandteil des Designs. Ohne Trust-Layer ist KI-First aus FM-Sicht unbrauchbar.
5. **Frau-Zwittich-Regel ist ein erstklassiges Bauprinzip.** Sichtbarkeit pro Rolle, „Coach-Modus" für Techniker (Fragen statt Antworten) — keine Workaround-Konstruktion, sondern eine Architektur-Eigenschaft des LLM-Gateways.

**KI-First heißt NICHT:**

1. **Nicht „KI ersetzt User".** Bei jeder Aktion mit Konsequenz (Status setzen, Ticket zuweisen, Mieter benachrichtigen) ist der Mensch der Entscheider. KI schlägt vor, hydratisiert, sortiert vor — nie autonom.
2. **Nicht „alles ist Magie".** Klare, deterministische Fallbacks für jede KI-Funktion. Wenn der KI-Dienst ausfällt, ist die App voll bedienbar — nur ohne Vorschläge.
3. **Nicht „ein großes Modell für alles".** Modell-Mix: kleines Modell für Klassifikation und Embeddings, großes Modell für Reasoning. Pro Use Case differenziert, kostenoptimiert.
4. **Nicht „alle Daten in die Cloud".** Pseudonymisierung am Gateway-Layer, Daten-Boundaries pro Use Case. Personenbezogene Daten (Mieter-Namen, Telefonnummern) gehen nur dann ins Cloud-Modell, wenn der Use Case es zwingend braucht — sonst pseudonymisiert.

---

## 2. Die Use Cases (was die KI konkret macht)

Reihenfolge nach Hebelwirkung × Aufwand, von links (einfach, viel Wert) nach rechts (komplexer, größerer Wert).

### 2.1 Ticket-Triage beim Eingang

**Was:** Unstrukturierter Input → strukturiertes Ticket-Vorschlag. Beispiele:

- **Telefonnotiz von Bereitschaft:** „Hr. Müller aus Westend hat angerufen, Heizung im 3. OG kalt seit gestern, mehrere Mieter betroffen, will Rückruf bis 10."
- **E-Mail vom Mieter:** „Sehr geehrte Damen und Herren, im Bad tropft seit gestern Wasser an der Decke, …"
- **EBO-Code (Stufe 2):** roher Code „RLT-3471" + Zeitstempel.

**KI macht:**
- Titel-Vorschlag: „Heizung 3. OG Westend kalt — mehrere Mieter"
- Beschreibung: aufbereitet, gestrafft
- Klassifizierung: Kategorie (`heizung`), Priorität (`P2`), Tickettyp (`reparatur`)
- Stammdaten-Match: Objekt = „Bürohaus Westend", Stockwerk = „3. OG", Melder = „Hr. Müller" (Fuzzy-Match auf Partner-Stammdaten)
- Fehlercode-Vorschlag: passt der Eingang zu einem bekannten Fehlercode? (z. B. HZG-1101)
- Wartet-Auf-Vorabprüfung: braucht's einen Nachunternehmer? Anhaltspunkt im Text?

**UX:**
Im Anlegen-Modal gibt es oben das Feld **„Schnellerfassung"** — Freitext (oder Diktat-Mikrofon, oder eingehängte Mail). „Übernehmen"-Button → KI füllt das ganze Formular vor. User bestätigt / ändert / speichert.

**Trust:** Confidence pro Feld (kleiner Balken im Label), `Why?`-Hover zeigt den Quellausschnitt.

### 2.2 Auto-Klassifizierung

**Was:** Sobald ein Ticket existiert (egal ob manuell oder per Triage erfasst), klassifiziert ein Hintergrund-Modell:
- Kategorie, Priorität, Anlage-Vorschlag, Tickettyp.
- Wenn schon vom User gesetzt: nicht überschreiben. Wenn leer: Confidence > 0.7 → vorschlagen, Confidence > 0.9 → vorbefüllen (aber als „KI-gesetzt"-Pill markieren, User kann tippen).

**Modell:** kleines lokales Klassifikator-Modell (in EU-Cloud, kein Cloud-LLM nötig). Lernt aus historischen Tickets pro Mandant.

**Wirkung:** Tickets werden in Sekunden klassifiziert statt durch Joachim. Das ist die Vorbedingung dafür, dass Joachim sich aus dem operativen Tagesgeschäft zurückziehen kann.

### 2.3 Ähnliche-Tickets-Suche per Embeddings (Admin-only)

**Was:** Im Ticket-Detail-Seitenpanel werden 3–5 ähnliche Tickets aus der Historie angezeigt — semantische Ähnlichkeit, nicht Volltext.

**Beispiel:** Aktuelles Ticket „Lüftung 3. OG läuft nicht an" → Vorschläge:
- T-1840 (vor 3 Monaten, gleicher Anlage, gelöst durch Filtertausch — 4 h)
- T-1782 (vor 6 Monaten, Lüftung 2. OG, gelöst durch Frostschutz-Reset — 1 h)
- T-1644 (vor 1 Jahr, Lüftung Süd, gelöst durch BSK-Quittierung — 0.5 h)

**Frau-Zwittich-Regel:** Sichtbar **nur für Admin/Büro**. Techniker sieht das Panel nicht — er soll selbst nachdenken. Admin kann beim Telefonat die Hinweise nutzen („hast du nach dem Filter geschaut?").

**Modell:** Embeddings lokal (`sentence-transformers`, EU-Cloud) — kostenlos pro Query, schnell.

### 2.4 Lösungsvorschläge aus Historie (Admin-only)

**Was:** Im Detail wird nicht nur „ähnliches Ticket", sondern auch dessen Lösungsweg destilliert: „In 3 von 3 ähnlichen Fällen war's der Filter, durchschnittliche Lösungsdauer 2,5 h."

**Modell:** Cloud-LLM (Claude Sonnet) für Zusammenfassung, gespeist aus den verlinkten Tickets.

**Frau-Zwittich-Regel:** Wieder Admin-only. Wird im selben Side-Panel angezeigt wie die ähnlichen Tickets.

### 2.5 EBO-Code-Lern-Loop

**Was:** Wenn ein Admin ein Ticket aus einer Fehlercode-Vorlage abschließt und im Verlauf einen besseren Lösungsweg dokumentiert hat, schlägt die KI vor, die Vorlage zu aktualisieren.

**Beispiel:**
- Vorlage RLT-3471 hat als Lösung: „Filter wechseln."
- Im Ticket-Verlauf steht: „Filter gewechselt, aber Differenzdruck blieb hoch — eigentliche Ursache war ein verstellter Volumenstrom-Regler. Justiert, Problem behoben."
- KI nach Ticket-Abschluss: „Soll die Vorlage RLT-3471 um den Hinweis zum Volumenstrom-Regler erweitert werden?" → Modal mit Vorher/Nachher-Diff.

**Modell:** Cloud-LLM für die Zusammenfassung des Verlaufs.

**Effekt:** Die Wissensbasis wächst organisch ohne separates Wartungs-Modul.

### 2.6 Natural-Language Search & Reporting

**Was:** Command-Palette (`Strg+K`, schon im Mockup vorhanden) bekommt KI-Power:

- „zeig mir tickets, die seit über 5 tagen wartet auf nachunternehmer sind"
- „welche objekte hatten dieses jahr die meisten klima-tickets"
- „welcher techniker hat in den letzten 4 wochen am meisten erledigt"
- „nachunternehmer mit auffällig vielen offenen tickets"

**Modell:** Cloud-LLM (Claude Haiku reicht) übersetzt NL in strukturierte Query → Filter wird im Pool angewendet **oder** Mini-Report wird inline gerendert.

**Sichtbarkeit:** Admin-only und Büro-only. Techniker hat seine fokussierte „Meine Tickets"-Sicht und braucht keine Cross-Reports.

### 2.7 Schreibassistenz für Beschreibungen, Kommentare, E-Mails

**Was:** Inline-Button „Verbessern" / „Zusammenfassen" / „Höflich formulieren" am Textfeld:
- Im Ticket: kurze Beschreibung → ausführliche Variante für Auftraggeber-Mail.
- Im Chat: rohe Notiz → freundlicher Kommentar für Mieter (Stufe 2 mit Mieter-Portal).
- E-Mail-Generierung an Nachunternehmer: Auftrag, Anhänge, höfliche Anrede.

**Modell:** Cloud-LLM (Haiku für einfach, Sonnet für komplex).

### 2.8 Smart Inbox / EBO-Filter-Layer (Stufe 2)

**Was:** EBO-Events landen in einem Pre-Inbox. KI-Filter:
- Cluster zusammenhängende Codes (z. B. 12 Filterstaus aus einem Objekt in 2 Minuten = ein Ticket, nicht zwölf).
- Self-Healing-Erkennung: wenn der gleiche Code 30 Min später automatisch gequittiert wird → Ticket nicht anlegen, im Log notieren.
- Routine vs. Eskalation: Bereitschaftsalarm nur bei wirklich kritischen, nicht selbst-heilenden Events.

**Wirkung:** Verhindert Notification-Müdigkeit, die das gesamte EBO-Anbindungs-Konzept entwertet (siehe plan.md Abschnitt 5.5).

### 2.9 Mieter-Vorab-Triage (Stufe 2+)

**Was:** Mieter-Portal hat einen Chatbot vor der Ticket-Erfassung:
- „Was funktioniert nicht?" → strukturierter Dialog → Ticket-Entwurf
- Erkennt Notfälle (Wasserrohrbruch, Brandgeruch) → Sofort-Eskalation
- Erkennt Trivialitäten („Wo finde ich die Hausordnung?") → beantwortet selbst, ohne Ticket anzulegen

**Modell:** Cloud-LLM, RAG (Retrieval-Augmented Generation) gegen Objekt-Wissensbasis (Hausordnung, FAQs).

### 2.10 Bereitschafts-Briefing & Tagesabschluss

**Was:** Wenn Bereitschaft anfängt (z. B. 17 Uhr Freitag), wird ein 5-Zeilen-Briefing erzeugt:
- Welche Tickets sind kritisch?
- Welche warten auf was?
- Welche Objekte hatten in der vergangenen Woche Auffälligkeiten?
- Welche Anlagen sollten heute Nacht beobachtet werden?

Analog: Tagesabschluss-Bericht für Joachim morgens — was war über Nacht, was hat sich verändert.

**Modell:** Cloud-LLM, läuft als Hintergrund-Job einmal pro Schichtwechsel.

---

## 3. Architektur — der LLM-Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (PWA, React)                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Assistant-Slot  │  │ Inline-Vorschläge│  │ NL-Search      │  │
│  │ (Side-Panel)    │  │ mit Confidence   │  │ (Cmd+K)        │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬───────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              KI-Gateway-Service (eigener Backend-Endpunkt)       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Auth + Rollen-Check (Frau-Zwittich-Schichtung)         │ │
│  │  2. Context-Builder (welche Daten? scope?)                 │ │
│  │  3. Pseudonymisierung (Namen/Telefon raus, IDs rein)       │ │
│  │  4. Prompt-Library (kuratierte Templates pro Use Case)     │ │
│  │  5. Modell-Router (lokal / Claude Haiku / Claude Sonnet)   │ │
│  │  6. Output-Validator (Schema-Check, Halluzinations-Filter) │ │
│  │  7. Re-Identifizierung (IDs zurück zu Namen)               │ │
│  │  8. Audit-Logger (was wurde gefragt, Antwort, Modell, $)   │ │
│  │  9. Cost-Tracker (Budget-Cap, Alerts)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└──┬──────────────────┬────────────────────┬──────────────────┬───┘
   │                  │                    │                  │
   ▼                  ▼                    ▼                  ▼
┌─────────┐   ┌──────────────┐   ┌─────────────────┐   ┌────────┐
│ Postgres│   │ Vector-DB    │   │ Lokale Modelle  │   │ Cloud  │
│ (Daten) │   │ (pgvector od.│   │ (EU-Cloud)      │   │ Claude │
│         │   │  Qdrant)     │   │ - sentence-tr.  │   │ API    │
│         │   │              │   │ - Klassifikator │   │ (EU)   │
└─────────┘   └──────────────┘   └─────────────────┘   └────────┘
```

**Kernprinzipien:**

- **Ein Gateway, viele Modelle.** Frontend redet nie direkt mit einem Modell. Alles geht durch den Gateway. Vorteil: Pseudonymisierung, Audit, Cost-Tracking, Modell-Wechsel ohne Frontend-Änderung.
- **Use Cases als kuratierte Prompts.** Pro Use Case (Triage, Klassifizierung, NL-Search, …) ein versioniertes Prompt-Template mit Tests. Prompt-Engineering ist Code, nicht Konfiguration.
- **Pseudonymisierung am Gateway.** Bevor irgendetwas an ein Cloud-LLM geht, werden personenbezogene Daten ersetzt: Mieter-Name → `[MIETER_42]`, Telefonnummer → `[TEL_42]`. Mapping bleibt im Gateway. Nach der Antwort werden die IDs zurückgemappt. So sieht das Cloud-Modell nie echte Personendaten.
- **Cost-Tracker mit Budget-Cap.** Pro Mandant ein Monatsbudget (z. B. 100 €). Bei Erreichen: Notification an Admin, weiterer Use Case wird per Default abgeschaltet (nur per Klick aktiviert). Verhindert Kostenexplosion.
- **Audit-Log pro KI-Aktion.** Was wurde gefragt, was wurde geantwortet, welches Modell, wie viele Tokens, wie viel hat's gekostet, wurde die Antwort akzeptiert? Pflicht-Audit auch für KI, nicht nur für User-Aktionen.

---

## 4. UX-Pattern — wie KI sich anfühlt

### 4.1 Trust-Stufen

Drei Autonomie-Stufen, je nach Use Case und Confidence:

| Stufe | Was | Beispiel |
|-------|-----|----------|
| **Vorschlag** | KI zeigt Vorschlag, User klickt aktiv „Übernehmen" | Triage-Vorschlag für neues Ticket |
| **Pre-Fill mit Markierung** | Feld ist gefüllt, aber farblich als „KI-gesetzt" markiert; User kann tippen und überschreibt nahtlos | Auto-Klassifizierung Kategorie/Prio bei hoher Confidence |
| **Stille Aktion** | KI macht es, kein User-Eingriff nötig — nur risikolose Aktionen | Embeddings beim Speichern berechnen, Cluster-Bildung im EBO-Filter |

**Wichtig:** Statusänderungen, Zuweisungen, externe Benachrichtigungen sind **nie stille Aktionen**. Maximal Pre-Fill mit User-Bestätigung.

### 4.2 Confidence-Indikator

Pro Feld eine kleine Skala (Punkte oder Balken):
- **Hoch (grün):** > 90 % → Pre-Fill, kaum hinterfragt
- **Mittel (gelb):** 60–90 % → Vorschlag mit Akzeptieren/Ablehnen
- **Niedrig (rot):** < 60 % → kein Vorschlag, User entscheidet von Hand

### 4.3 „Why?"-Button

Jeder KI-Vorschlag hat einen Hover-Tooltip oder Inline-Knopf, der zeigt: **woher kommt das?**
- „Klassifiziert als `heizung` weil Worte ‚Vorlauftemperatur', ‚Kessel', ‚Heizkreis' im Text."
- „Vorgeschlagener Fehlercode HZG-1101 weil 8 ähnliche Tickets in der Historie diesen Code hatten."
- „Priorität P2 weil Schlüsselwort ‚mehrere Mieter betroffen' + Zeitfenster ‚seit gestern'."

Ohne `Why?` ist KI eine Black Box — das untergräbt Vertrauen.

### 4.4 Akzeptieren / Ablehnen / Korrigieren

Pro Vorschlag drei Aktionen — und alle drei sind Lern-Signal:

- **✓ Akzeptieren:** Vorschlag wird übernommen. Modell „weiß", dieser Vorschlag war gut.
- **✗ Ablehnen:** Vorschlag wird verworfen. Modell „weiß", dieser Vorschlag war falsch (in Reporting sichtbar).
- **✎ Korrigieren:** User editiert den Vorschlag. Modell „weiß", dieser Vorschlag war fast richtig — Diff wird zum Trainingssignal.

Beim Klassifikator (lokales Modell) wird daraus ein Online-Lern-Loop. Beim Cloud-LLM ein Feedback-Statistik für die Prompt-Pflege.

### 4.5 Always-On Assistant-Slot

In jedem Hauptview ist rechts ein Schmalpanel (collapsable, 320 px breit, standardmäßig zugeklappt). Inhalt kontextabhängig:
- Im Ticket-Detail (Admin): ähnliche Tickets + Lösungsvorschläge + Fehlercode-Match.
- Im Pool: Smart-Inbox-Stand, Cluster-Hinweise.
- Im Dashboard: NL-Frage-Eingabe für Reports.
- In den Fehlercodes: Lern-Loop-Hinweise.

Techniker: Slot zeigt **kein** Lösungs-Material, sondern nur „Coach-Modus" (siehe nächster Abschnitt).

### 4.6 Coach-Modus für Techniker (Frau-Zwittich-fähig)

Statt Lösungsvorschlägen bekommt der Techniker im Assistant-Slot **Fragen**:

- „Hast du den Differenzdruck geprüft?"
- „Ist die Anlage in der letzten Wartung als auffällig vermerkt?"
- „Wurde das Filterelement im letzten Quartal getauscht?"

Die KI weiß die Antwort intern (aus dem Lösungstext der EBO-Vorlage), gibt sie aber nicht direkt — sie stellt die Frage, die zur Antwort führt. Frau Zwittichs Forderung erfüllt: Techniker denkt selbst, wird aber strukturiert geführt. Kein Veto, sondern Empowerment.

### 4.7 NL-Eingabe in der Command-Palette

`Strg+K` öffnet die Quick-Search (schon im Mockup). KI-First macht daraus:

- **Strukturierte Suche:** „T-2044", „Hr. Müller", „Bürohaus Westend" → wie heute.
- **NL-Query:** „tickets seit 5 tagen wartet auf nachunternehmer" → Filter wird angewendet.
- **NL-Aktion:** „neues ticket: heizung 3. og kalt, hr. müller, seit gestern" → öffnet Anlegen-Modal mit Vorbefüllung.
- **NL-Report:** „welche objekte hatten dieses jahr meiste klima-tickets" → Mini-Bar-Chart inline.

User muss nicht entscheiden, was er meint — der Gateway routet automatisch.

---

## 5. Datenschutz & DSGVO

Pflichtdisziplin für jeden Use Case, nicht nachgelagert:

1. **EU-Hosting für alles.** Modelle und Daten in EU-Cloud. Claude API über Anthropic EU-Endpoint (oder via AWS Bedrock EU-Region), keine US-Endpoints.
2. **Pseudonymisierung am Gateway** (siehe Architektur). Mieter-Namen, Telefon, E-Mail, Adressdetails werden vor dem Cloud-Modell ersetzt. Mapping bleibt im Gateway.
3. **Daten-Boundaries pro Use Case.** Pro Prompt-Template ist definiert: welche Felder gehen ins LLM, welche nicht. Z. B. Klassifikation braucht Titel+Beschreibung, **nicht** Mieter-Identität.
4. **Opt-out pro User.** In den User-Einstellungen Schalter „KI-Vorschläge nutzen: ja/nein". Wer aus ist, sieht die App so wie ohne KI — voll funktional.
5. **Opt-out pro Ticket (Stufe 2).** Tickets können als „sensibel — keine KI" markiert werden (Beispiel: Streitfall mit Mieter, anwaltliche Korrespondenz).
6. **Audit-Log pro KI-Aktion** mit Modell, Token-Count, Antwort-Hash. Falls später Streit: nachvollziehbar.
7. **Retention.** Prompts und Antworten werden nicht beim LLM-Anbieter zwischengespeichert (Zero-Retention-Vertrag, bei Anthropic und OpenAI verfügbar).
8. **Keine Trainings-Daten an Anbieter.** Standardmäßig wird ausgeschlossen, dass Joachims Daten in die Modell-Trainingsdaten des Anbieters einfließen (vertraglich + technisch).
9. **AVV** (Auftragsverarbeitungsvertrag) mit Anbieter, Standardvertragsklauseln gemäß EU-Recht.
10. **Mieter-Transparenz** (Stufe 2 mit Mieter-Portal). Datenschutzerklärung erklärt, dass Eingaben pseudonymisiert von einer KI strukturiert werden — keine schwarzen Boxen.

---

## 6. Modell-Strategie & Kosten

**Drei Modell-Klassen, klar getrennt:**

### A) Lokales Klassifikator-Modell (EU-Cloud, kein LLM)

- **Wozu:** Auto-Klassifizierung (Kategorie, Prio, Tickettyp). Pseudonymisierungs-Erkennung. Anomalie-Detection.
- **Technologie:** `sentence-transformers` (Embeddings) + lightweight Classifier (Logistic Regression / Small Transformer).
- **Wo:** In EU-Cloud (Hetzner / Azure EU) als kleiner Inferenz-Service. Selbst gehostet.
- **Kosten:** ~10–20 €/Monat reiner Hosting, kein Per-Query-Cost.
- **Skalierung:** Skaliert trivial bei Joachims Größe.

### B) Cloud-LLM für Reasoning

- **Wozu:** Triage, NL-Search/Reporting, Schreibassistenz, Lösungs-Zusammenfassung, EBO-Lern-Loop.
- **Empfohlene Modelle:**
  - **Default: Claude Haiku 4.5** (`claude-haiku-4-5-20251001`). Schnell, günstig, gut genug für 80 % der Use Cases. Über Anthropic EU-Endpoint oder Bedrock EU.
  - **Eskalation: Claude Sonnet 4.6** (`claude-sonnet-4-6`). Wenn Haiku-Confidence niedrig oder Use Case anspruchsvoller (Lösungsvorschläge mit Quellen-Verknüpfung, komplexe Reports).
  - **Reserve: Claude Opus 4.7** (`claude-opus-4-7`). Nur für sehr komplexe Smart-Reports — selten benötigt bei Joachims Größe.
- **Kosten-Indikation:**
  - Triage: ~50 Tickets/Monat × ~1.500 Tokens × Haiku-Pricing → < 5 €/Monat.
  - NL-Search: ~200 Queries/Monat × ~800 Tokens × Haiku → < 5 €/Monat.
  - Lösungs-Zusammenfassung: ~30 Anwendungen/Monat × ~5.000 Tokens × Sonnet → < 15 €/Monat.
  - **Gesamt Joachims Größe: 30–80 €/Monat** (indikativ, vor Aufwandsschätzung nicht verbindlich).

### C) Vector-DB (Embeddings-Speicher)

- **Wozu:** Embedding-Suche für ähnliche Tickets, Fehlercode-Matching.
- **Technologie:** `pgvector` (Postgres-Extension) oder Qdrant.
- **Wo:** Im selben Postgres wie die App, kein separater Dienst nötig.
- **Kosten:** 0 € extra (lebt im Postgres).

**Modell-Router-Logik (Gateway):**
```
use_case = "triage"
  → versuche Haiku, bei Confidence < 0.7: eskaliere zu Sonnet
use_case = "klassifizierung"
  → lokales Modell, kein Cloud-LLM
use_case = "embedding"
  → lokales Embedding-Modell, keine Cloud-LLM
use_case = "nl_search"
  → Haiku
use_case = "loesung_zusammenfassen"
  → Sonnet (Reasoning-anspruchsvoll)
use_case = "smart_report"
  → Sonnet, bei < 0.6 Confidence: Opus
```

**Modell-Wechsel:** Wenn Anthropic ein besseres Modell rausbringt — nur Gateway-Konfig anpassen, nichts in der App. Wenn ein anderer Anbieter (Mistral EU, Aleph Alpha, …) attraktiver wird — Router zusätzlich konfigurieren, Use-Case-weise umschalten. Kein Lock-in.

---

## 7. Trust-Modell — die Schichten der Sichtbarkeit

Übersicht, wer was sieht und wer was darf:

| Use Case | Admin | Büro | Techniker | Mieter (Stufe 2) |
|----------|:-----:|:----:|:---------:|:----------------:|
| Triage-Vorschlag akzeptieren | ✓ | ✓ | — | — |
| Auto-Klassifizierung (Hintergrund) | ✓ wirkt | ✓ wirkt | ✓ wirkt | ✓ wirkt |
| Ähnliche Tickets sehen | ✓ | ✓ | **NEIN** | — |
| Lösungsvorschläge sehen | ✓ | ✓ | **NEIN** | — |
| Coach-Modus (Fragen) | — | — | ✓ | — |
| NL-Search / Reporting | ✓ | ✓ | — (eigene Tickets nur) | — |
| Schreibassistenz im Chat | ✓ | ✓ | ✓ (nur für eigene Tickets) | ✓ (nur Mieter-Portal) |
| Mieter-Vorab-Triage | — | sieht Ergebnis | — | ✓ nutzt |
| Lern-Loop für EBO-Vorlagen | ✓ | — | — | — |
| KI-Audit-Log einsehen | ✓ | — | — | — |
| KI-Budget verwalten | ✓ | — | — | — |

Diese Tabelle ist die Brücke zum [Berechtigungskonzept](Konzept_Berechtigung_und_EBO_Vorlagen_2026-05-19.md) — sobald die RBAC-Schicht (Teil A des dortigen Konzepts) gebaut wird, lebt diese Sichtbarkeits-Matrix konsistent darin. Solange Teil A im Backlog ist, reicht der Mockup-`istAdmin`-Pauschalcheck plus eine separate Techniker-Rolle für den Coach-Modus.

---

## 8. Rollout — wie wir KI-First schrittweise in die Software bringen

**Stufe 0 (jetzt — Mockup):**
- Mockup-Vorbereitung der KI-Hooks: UI-Slots reserviert, Hardcoded-Demos, „kommt mit KI"-Pills. Joachim sieht, wo später was passiert.
- Konkret: Assistant-Slot im Ticket-Detail mit statischen Beispiel-Vorschlägen; Coach-Modus mit fixen Fragen; „Schnellerfassung"-Feld im Anlegen-Modal das den Text einfach in die Beschreibung kopiert.
- **Keine echte KI-Anbindung in Stufe 0** — nur UX-Validierung mit Joachim.

**Stufe 1 — schmale KI-First-Basis:**
- LLM-Gateway-Service mit Pseudonymisierung, Audit, Cost-Tracker. Auch wenn anfangs nur 2 Use Cases bedient werden — die Architektur steht.
- Vector-DB (pgvector) im Postgres.
- Lokales Embedding-Modell läuft.
- **Erste Use Cases live:**
  - Ähnliche-Tickets-Suche (Admin-Side-Panel)
  - NL-Search in der Command-Palette
  - Triage-Vorschlag im Anlegen-Modal (über Cloud-LLM)
  - Auto-Klassifizierung (lokales Modell) im Hintergrund
- **Frau-Zwittich-Schichtung von Anfang an** wirksam.

**Stufe 2 — Vollausbau:**
- EBO-Anbindung + KI-Filter-Layer (Cluster, Self-Healing, Routine vs. Eskalation).
- Lösungsvorschläge auf Basis ähnlicher Tickets + EBO-Vorlagen.
- Smart-Reporting (NL → Bar/Line-Chart inline).
- EBO-Lern-Loop in Vollausbau.
- Mieter-Portal mit Vorab-Triage.
- Bereitschafts-Briefing als Hintergrund-Job.

**Stufe 3 — Optimierung & Lern-Effekte:**
- Domänenspezifisches Fine-Tuning des Klassifikators auf Joachims Daten.
- Eskalations-Logik verfeinern.
- Predictive Maintenance (Anomalie-Trends).

---

## 9. Konsequenzen für den bisherigen Plan

KI-First ändert den bisherigen plan.md an einigen Stellen:

| Bereich | Bisher | Mit KI-First |
|---------|--------|--------------|
| **Datenmodell** (plan.md Abschnitt 9) | Tickets als reine Datensätze | Tickets bekommen `embedding_vec` als Spalte (auch wenn Stufe 1 sie nur intern nutzt) |
| **Backend-Sprache-Wahl** (plan.md Abschnitt 8) | Fastify oder FastAPI | Tendenz zu **FastAPI**, weil bessere KI/ML-Ökosystem-Anbindung (Python-Tools, Embedding-Bibliotheken) |
| **Stufe-1-Scope** (plan.md Abschnitt 5) | „Kein EBO, keine KI." | **Kein EBO, aber schon erste KI-Use-Cases** (Triage, Auto-Klassifizierung, Ähnliche-Tickets). Das verschiebt die Stufe-1-Grenze. |
| **Hosting** (plan.md Abschnitt 8) | EU-Cloud generisch | EU-Cloud + dedizierter Modell-Inferenz-Service (klein, aber separat). Hetzner reicht. |
| **Auth-/Rollen-Konzept** | (siehe RBAC-Konzept) | RBAC wird wichtiger, weil Frau-Zwittich-Schichtung nicht mehr „nur" Sichtbarkeit ist, sondern in den Gateway-Layer eingebaut werden muss. Empfehlung: RBAC-Konzept (Teil A) parallel zu KI-First bauen — sonst gibt es Workarounds. |
| **Aufwandsschätzung** (plan.md OP #7) | offen | KI-First erhöht den Stufe-1-Aufwand spürbar (Schätzung: +30–50 %), aber spart Stufe-2-Refactoring. Senior-Entwickler-Abstimmung nötig. |

---

## 10. Risiken & wie wir sie adressieren

| Risiko | Adressierung |
|--------|--------------|
| **Halluzinationen** (KI erfindet Fakten) | Output-Validator im Gateway: Schema-Check, Quellen-Verifikation. Bei Klassifikation: Confidence-Schwelle. Bei Reports: nur aus tatsächlichen DB-Zahlen, kein „kreatives" Schreiben. |
| **Prompt-Injection** (Mieter-Input enthält Anweisungen für die KI) | Strikte Trennung System-Prompt ↔ User-Input. User-Input wird als Daten markiert, nicht als Anweisung. Allowlist-Validator für strukturierte Outputs. |
| **Kosten-Eskalation** | Budget-Cap pro Mandant, Notification bei 80 %. Bei 100 %: KI-Funktionen werden disabled (nicht der App-Kern!). Cost-Tracker zeigt Joachim live, was er ausgibt. |
| **Modell-Lock-in** | Modell-Router-Architektur. Use Cases sind anbieter-agnostisch implementiert. Wechsel z. B. von Anthropic zu Mistral durch Konfig, nicht durch Code-Rewrite. |
| **Vertrauenserosion** bei schlechten Vorschlägen | Confidence-Indikator, „Why?"-Button, Akzeptieren/Ablehnen — User behält Kontrolle. Bei wiederholtem Ablehnen eines Use Cases: Notification an Admin, „dieser Prompt liefert schlechte Vorschläge, bitte überarbeiten". |
| **Datenleak via Cloud-LLM** | Pseudonymisierung am Gateway. Zero-Retention-Vertrag. EU-Endpoint. AVV. Daten-Boundaries pro Use Case. |
| **„KI ist Magie"-Erwartung bei Joachim** | Transparente Kommunikation: KI assistiert, ersetzt nicht. Confidence-Anzeige. Konkrete Use-Case-Demos statt abstrakte Versprechen. |
| **Stufe-1-Overengineering** | KI-First-Architektur strikt minimal halten in Stufe 1: Gateway, Vector-DB, 4 Use Cases — keine 20. Erst Wirkung zeigen, dann erweitern. |
| **Wartbarkeit der Prompts** | Prompt-Library im Code, versioniert, getestet (Eval-Suite mit Erwartungswerten pro Prompt). Wer Prompt ändert, muss Eval-Suite grün halten. |

---

## 11. Offene Punkte / Abstimmungsbedarf

1. **Stufenmodell-Verschiebung mit Joachim besprechen.** Bisher hat Joachim die Erwartung, Stufe 1 sei „intern, ohne KI". Mit KI-First wird Stufe 1 mehr — kostet mehr, liefert aber sofort sichtbare Wirkung. Vorschlag: Demo der KI-First-UI in der 3. Joachim-Demo, danach Entscheidung.
2. **Modell-Anbieter-Klärung.** Empfehlung Anthropic Claude (EU-Endpoint). Alternativen: Mistral (EU-nativ), Aleph Alpha (DE), OpenAI EU. Mit Senior-Entwickler abgleichen, was zu Backend-Stack passt.
3. **Lokales Klassifikator-Hosting.** Eigener Inferenz-Service in Hetzner? Oder Hugging Face Inference Endpoints EU? Trade-off Kontrolle vs. Setup-Aufwand.
4. **Embedding-Strategie.** Pro-Mandant getrennte Vektoren oder globaler Index? Empfehlung: pro Mandant, weil DSGVO-Trennung sauberer.
5. **Wer pflegt Prompts und Eval-Suite?** Senior-Entwickler-Aufgabe, aber Joachim/Tim brauchen einen Feedback-Mechanismus (Akzeptieren/Ablehnen liefert nur Statistik, nicht den Grund).
6. **Coach-Modus für Techniker konkret durchdenken.** Welche Fragen-Sets sind sinnvoll? Wer pflegt sie? Vorschlag: pro EBO-Vorlage ein Fragen-Block neben dem Lösungstext, von Admins pflegbar — die KI nimmt diese Fragen, bei keinen vorgepflegten generiert sie aus dem Lösungstext.
7. **Frau Zwittichs Sicht.** Sie hat das Veto gegen Lösungs-Push an Techniker formuliert. Coach-Modus ist die Antwort, aber sie sollte ihn live sehen und freigeben. Vor der 3. Joachim-Demo mit ihr besprechen.
8. **Audit-Log-Tiefe.** Reicht „was wurde gefragt + Antwort + Modell + Kosten"? Oder zusätzlich: Welche Daten waren im Context, bevor Pseudonymisierung? Empfehlung: ja, aber verschlüsselt, nur bei Streit zugänglich.
9. **Stufe-1-Aufwandsschätzung mit KI-First neu kalkulieren.** Aktueller `Aufschlag_intern_*.docx` geht von „keine KI in Stufe 1" aus. Mit KI-First muss er um den Gateway, Vector-DB, ersten 4 Use Cases erweitert werden.
10. **Mockup-Vorbereitung.** Welche KI-Hooks zeigen wir in der 3. Joachim-Demo? Vorschlag: Assistant-Slot im Ticket-Detail mit ähnlichen Tickets (statisch), „Schnellerfassung"-Feld im Anlegen-Modal (lokaler regex-Trick statt echter KI), Coach-Modus mit 3 Fragen aus dem aktuellen Fehlercode.

---

## 12. Was als Nächstes konkret passieren könnte (Vorschlag, abhängig von Tims Freigabe)

1. **Konzept prüfen** — Tim liest, gibt Feedback / Korrekturen / Freigabe-Signal.
2. **Mockup-Vorbereitung Stufe 0** (vor 3. Joachim-Demo):
   - Assistant-Slot rechts im Ticket-Detail (kollabierbar) mit statischen „Ähnliche Tickets"-Beispielen.
   - „Schnellerfassung"-Feld oben im Anlegen-Modal (heute zeigt es nur den Text in die Beschreibung — Demo-Charakter).
   - Coach-Modus-Box im Techniker-Detail mit 3 fixen Fragen aus dem aktiven Fehlercode.
   - „Why?"-Tooltip-Pattern als Komponente.
   - Confidence-Indikator als wiederverwendbares Pill-Element.
3. **plan.md aktualisieren** — Abschnitt 6 (KI in Stufe 2) wird umgeschrieben zu „Architektur-Prinzip von Stufe 1, mit gestaffeltem Funktionsumfang". Stufe-1-Scope erweitert.
4. **Aufwandsschätzung mit Senior-Entwickler nachziehen.** Der bisherige `Aufschlag_intern_*.docx` braucht KI-Gateway als eigenen Architektur-Baustein.
5. **3. Joachim-Demo** mit KI-First-Vorgriff im Mockup. Joachim entscheidet, ob er den höheren Stufe-1-Aufwand mitgehen will oder klassisch ohne KI startet.
6. **Wenn Joachim Ja sagt:** Stufe-1-Bau startet mit Gateway-Architektur, parallel werden 4 erste Use Cases gebaut.

---

*Sobald Tim Freigabe gibt, gehen die Mockup-Vorbereitungen unter `02_draft/fm-stoerungen/` los — die KI-Hooks (Slots, Pills, Tooltips) sind low-effort und sofort sichtbar wirksam, ohne dass echte Modelle angeschlossen sein müssen. Bis dahin: kein Code.*
