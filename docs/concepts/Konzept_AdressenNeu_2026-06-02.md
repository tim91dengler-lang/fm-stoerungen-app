# Konzept: Adressen-Neukonzept: einheitlicher, dublettenarmer Adress-Erfassungs- und Auswahl-Flow (Stufe 1 / Pilot)

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **Entwurf zur Abstimmung**
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** Ist-Zustand mehrgleisig im Code recherchiert (Datei:Zeile-Belege), dann strukturierter Entwurf.
> **Bezug:** `docs/plan.md` (Roadmap), `docs/tech-spec.md` (Pflichtenheft), CLAUDE.md §4 (Listen-/UX-Konvention).
> **Aufwand (grob):** M

---

## 1. Ziel

Adressen sollen für Joachims Team schnell, fehlerarm und ohne Dubletten erfasst werden — egal ob am Ticket, am Objekt, am Haus oder am Partner. Heute existiert die Infrastruktur (echte Adress-Tabelle, Photon-Autocomplete, Maps-Link, eigene Stammdaten-Liste), aber der Eingabe-Flow ist über drei verschiedene UI-Paradigmen verteilt und produziert systematisch Dubletten. Ziel ist EIN wiederverwendbarer Adress-Picker (Suchen ODER per Autocomplete neu anlegen, mit Dubletten-Warnung) plus PLZ-Plausibilität, der alle Konsumenten gleich bedient. Zielgruppe: Techniker/Admins im Pilot, die unter Zeitdruck Tickets erfassen.

## 2. Ist-Zustand (heute im Code)

Die Backend-Basis ist solide und plan-konform: echte Tabelle `adressen` mit strukturierten Feldern + lat/lng + geocode_source (apps/api/src/fm_api/models/adresse.py:15-36), CRUD-Service + `/adressen/suggest`-Endpoint mit Photon-Proxy (apps/api/src/fm_api/api/v1/adressen.py:19-33), Photon-Service mit 24h-LRU-Cache und graceful Fallback (apps/api/src/fm_api/services/photon_service.py:109-166), Maps-Link bevorzugt Koordinaten (apps/web/src/lib/adresse.ts). Adresse wird n:1 referenziert von Objekt (objekt.py:28), Objektstruktur/Haus (objektstruktur.py:57), Ticket-Override (ticket.py:89-93) und Partner via Junction mit Typ (partner.py:208-240).

WAS NICHT REICHT — die UI ist fragmentiert und dublettenanfällig:
1) DREI unterschiedliche Eingabe-Paradigmen nebeneinander: (a) Ticket nutzt Photon-Combobox + DB-Such-Picker + Inline-Anlegen (TicketAdresseField.tsx:159-246), (b) HausModal bietet NUR ein `<select>` über bis zu 500 vorgeladene Adressen — keine Suche, kein Inline-Anlegen, kein Photon (HausModal.tsx:133-149; ObjektDetailPage.tsx:99-101 lädt limit:500), (c) PartnerAdresseModal nutzt nur den DB-Picker AdresseSearchSelect, ohne Photon (PartnerAdresseModal.tsx:126), (d) AdressenPage-Modal hat das volle Photon-Formular (AdressenPage.tsx:380-385). Zwei separate Such-Komponenten existieren parallel: AdresseSearchSelect (DB-Suche+Browse-Modal) und AdressSuggestCombobox (Photon).
2) KEINE Dubletten-Erkennung: `/suggest` liefert ausschließlich Photon-Treffer, nie bestehende DB-Adressen (endpoints.ts:458). Jedes Inline-Anlegen über die Photon-Combobox erzeugt eine neue Zeile, auch wenn dieselbe Adresse schon existiert. Im Service gibt es kein normalize/unique/dedup (adresse_service.py: kein Treffer für „unique/duplicate/normalize"). Das untergräbt das plan.md-Versprechen „einmal richtig erfasst, Wiederverwendung" (plan.md:129).
3) KEINE PLZ-Validierung, obwohl plan.md:129 und tech-spec sie für Stufe 1 fordern — Pydantic prüft nur `min_length=1, max_length=20` (schemas/adresse.py:12), Land ist freier 2-Letter-Code ohne Whitelist.
4) Objekt-Default-vs-eigene-Adresse-Logik ist im Ticket gut gelöst (Anzeige „vom Objekt" / „eigene Adresse", Rücksetzen auf Objekt-Default; TicketAdresseField.tsx:118-120,178-190), aber am Haus inkonsistent umgesetzt (Default-Vorbelegung per objektAdresseId statt echter Vererbungs-Anzeige; HausModal.tsx:60) und für die Objekt-Adresse selbst gibt es gar keinen komfortablen Picker.
5) Geocodierung ist Best-Effort: `geocode_source='photon'` nur wenn der User einen Vorschlag klickt (TicketAdresseField.tsx:95); manuell getippte Adressen bleiben ohne Koordinaten → Maps-Link fällt auf Text-Query zurück. Kein Geocoding-on-save im Backend.

## 3. Scope — erste Ausbaustufe (Pilot)

- EIN wiederverwendbarer Adress-Picker `<AdressePicker>` als core-Komponente, der AdresseSearchSelect + AdressSuggestCombobox + Inline-Anlegen in einem konsistenten Flow vereint: oben eine Suchzeile, die GLEICHZEITIG bestehende DB-Adressen UND Photon-Vorschläge zeigt (zwei Sektionen: 'Vorhandene' / 'Neu aus Vorschlag anlegen').
- Dubletten-Bremse im Backend: `find_match`-Logik (normalisierter Vergleich strasse+hausnummer+plz, case-/whitespace-insensitiv) vor jedem Inline-Create; bei Treffer wird die bestehende Adresse zurückgegeben statt neu angelegt. Optional ein `GET /adressen/suggest`-Erweiterung oder neuer `GET /adressen/match`, der DB-Treffer mitliefert.
- PLZ-Plausibilität: Pydantic-Validator (DE: 5 Ziffern; generisch nach Land), Land gegen kleine Whitelist (DE/AT/CH zunächst). Inline im Picker als sanfte Warnung, nicht hart blockierend.
- Picker überall einsetzen: HausModal, PartnerAdresseModal, Objekt-Adresse (ObjektDetailPage) und Ticket bekommen denselben `<AdressePicker>` — die `<select>`-Krücke im HausModal entfällt, das limit:500-Preload entfällt.
- Objekt-Default überschreibbar einheitlich: konsistente Herkunfts-Anzeige ('vom Objekt geerbt' / 'eigene') + 'Auf Objekt-Adresse zurücksetzen' an Haus und Ticket nach demselben Muster wie heute schon im Ticket.
- Geocoding-on-save (Backend): beim Create/Update ohne Koordinaten einmalig Photon-Lookup versuchen und lat/lng + geocode_source füllen (best-effort, non-blocking), damit Maps-Links präzise sind.

**Bewusst NICHT jetzt (später / Nordstern):**

- Internationale PLZ-Validierung über DE/AT/CH hinaus (Stufe 3, internationale Mandanten)
- Automatischer Merge bestehender Dubletten im Datenbestand (separater Bereinigungs-Task, nicht jetzt)
- Eigener Kartenpicker / Pin-auf-Karte zum Geocoden (Maps-Link reicht für Pilot)
- Adress-Validierung gegen offizielle Post-Verzeichnisse / DHL-API (kostenpflichtig, Stufe 2+)
- Harter DB-Unique-Index auf Adressen (erst nach Bewährung der weichen Dedup)
- npm-Paketierung des Adress-Moduls als Plattform-Core (Stufe 3, ADR-0001)

## 4. Architektur-Skizze

Backend (FastAPI, bounded context core/): (1) `adresse_service.find_or_create(mandant_id, payload)` mit Normalisierung — neue Helper `_normalize_key(strasse,hausnummer,plz)`; vorher SELECT auf normalisierten Vergleich; Mandant-scoped (analog fk-mandant-validierung-Memory). (2) Neuer/erweiterter Endpoint: `GET /adressen/match?q=` ODER `/suggest` um eine `source`-Markierung ('db' | 'photon') erweitern, sodass das Frontend einen Aufruf für beides hat. (3) PLZ-Validator + Land-Whitelist in schemas/adresse.py (Pydantic v2 field_validator). (4) Optionaler `geocode_on_save`-Hook in create/update_adresse (Photon-Reuse aus photon_service, async, Fehler schlucken). Migration nur falls Unique-Index gewünscht — vorerst KEIN harter DB-Constraint (idempotent halten, Dubletten weich verhindern).

Frontend (React, core/-Komponente): Neue `apps/web/src/core/adresse/AdressePicker.tsx` ersetzt die parallele Nutzung von AdresseSearchSelect + AdressSuggestCombobox. Props: `{ value: AdresseRead|null, onChange, inheritFrom?: {adresse, label} }`. Intern: ein Suchfeld → useQuery gegen den vereinten Endpoint, Ergebnis in zwei Sektionen (Vorhandene DB-Adressen zuerst, dann Photon-Neuvorschläge mit Badge 'neu'); Klick auf DB-Treffer = wählen, Klick auf Photon-Treffer = find_or_create + wählen. Wiederverwendung der vorhandenen Bausteine (Debounce, Browse-Modal aus AdresseSearchSelect). Die bestehenden Komponenten bleiben als interne Teile oder werden konsolidiert. Maps-Link/formatAdresse aus lib/adresse.ts unverändert weiternutzen. Passt zur CLAUDE.md-Konvention 'combobox-mit-inline-anlegen' (tech-spec:1313).

## 5. Offene Fragen — von Tim zu entscheiden

1. Dubletten-Strategie: WEICH (Backend gibt bei Match bestehende Adresse zurück, kein DB-Constraint) oder HART (Unique-Index auf normalisiertem Schlüssel + Migration)? Empfehlung: weich für Stufe 1 — flexibler, idempotenz-freundlich.
2. Adress-Granularität: Soll eine Adresse ohne Hausnummer (nur Straße/Ort) als Dublette zu einer mit Hausnummer gelten? Beeinflusst die Normalisierungs-Regel.
3. Geocoding-on-save: synchron beim Speichern (kleine Latenz, sofort Koordinaten) oder gar nicht in Stufe 1 (nur bei explizitem Vorschlag-Klick wie heute)? Kostet pro Save einen Photon-Request.
4. Land-Whitelist: nur DE/AT/CH (Joachim regional) oder offen lassen? PLZ-Regel hängt daran.
5. Bestehende Adressen mit Tippfehler-Dubletten im Pilot-Datenbestand: Brauchen wir einen einmaligen Merge-/Bereinigungs-Helfer, oder reicht 'ab jetzt sauber'? Empfehlung: 'ab jetzt sauber' für Stufe 1.
6. Soll der vereinte Picker DB-Treffer ODER Photon-Treffer priorisieren, wenn beides matcht? Empfehlung: DB zuerst (Wiederverwendung erzwingen).

## 6. Umsetzungsschnitt (Reihenfolge / PR-Pakete)

1. PR 1 (Backend, S): PLZ-/Land-Validator in schemas/adresse.py + Tests. Reiner Datenqualitäts-Gewinn, keine UI-Abhängigkeit.
2. PR 2 (Backend, M): `find_or_create` + Normalisierung im adresse_service, vereinter Such-Endpoint (DB + Photon mit source-Flag), Integration-Tests inkl. Mandant-Scoping.
3. PR 3 (Frontend, M): neue core/adresse/AdressePicker.tsx (vereinte Suche, zwei Sektionen, Inline-Anlegen über find_or_create). Erst isoliert, dann im Ticket einsetzen (ersetzt TicketAdresseFields Editor-Innenteil).
4. PR 4 (Frontend, S): Picker in HausModal (select+preload raus), PartnerAdresseModal und Objekt-Adresse einsetzen; einheitliche 'geerbt/eigen + zurücksetzen'-Anzeige an Haus.
5. PR 5 (Backend, S, optional): Geocoding-on-save best-effort, hinter Entscheidung aus offener Frage. E2E-Smoke über Ticket-Erfassen-Flow vor Tim-Acceptance.

## 7. Risiken

- Photon (komoot.io, extern) als einzige Geocoding-Quelle: Rate-Limits/Ausfall möglich. Heute schon graceful (leere Liste), aber Geocoding-on-save würde Save-Latenz an Photon koppeln — non-blocking implementieren.
- Normalisierungs-Regel für Dubletten ist heikel: zu streng = echte Nachbar-Adressen verschmelzen, zu locker = Dubletten bleiben. Braucht Test-Abdeckung mit realen Joachim-Beispielen.
- Konsistente Migration (Memory konsistente-migration): Adress-Picker-Wechsel betrifft 4 Konsumenten (Ticket, Haus, Objekt, Partner) — alle müssen mitgezogen werden, sonst bleiben zwei Paradigmen parallel.
- DSGVO: Adressen sind personenbeziehbar (Mieter); Dubletten-Match darf nicht über Mandanten-Grenze suchen (mandant_id-scope strikt halten, fk-mandant-validierung-Memory).
- Kein harter Unique-Constraint = Dubletten weiterhin technisch möglich über Direkt-API/AdressenPage-Modal; weiche Lösung nur so gut wie ihre Nutzung im Picker.

---

*Konzept zuerst. Bis zur Freigabe durch Tim: kein Code.*
