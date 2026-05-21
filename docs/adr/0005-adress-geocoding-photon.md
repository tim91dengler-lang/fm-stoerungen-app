# ADR 0005 — Adress-Geocoding via Photon (Komoot, EU-gehostet)

- **Status:** Akzeptiert
- **Datum:** 2026-05-21
- **plattform-relevant:** ja (Adress-Modul ist Plattform-Kandidat 3)

## Kontext

Adress-Modul (Slice 2) braucht Vorschlagsfunktion: User tippt „Schweizer Straße 88, Frankfurt", System schlägt strukturierte Treffer mit lat/lng zur Auswahl vor.

Anforderungen:
- **DSGVO / EU-Hosting** (Adressen sind PII)
- **Bezahlbar** in unserer Größenordnung (Joachim: <100 Mitarbeitende, geschätzte Adress-Suche-Frequenz < 100 Requests/Stunde)
- **International vorbereitet** (Land-Feld, später auch Schweiz / Österreich)
- **Open-Data-Basis** akzeptabel — OpenStreetMap reicht für FM-Use-Case (Mieter-/Eigentümer-Adressen sind Standard-Wohn-/Bürohaus-Adressen)

## Optionen

**A — Photon (Komoot, OpenStreetMap-basiert).**
- ⊕ Komplett kostenlos, Open Source (Apache-2.0)
- ⊕ Sehr fehlertolerant („Schweiz Str 88 FFM" → korrekte Treffer)
- ⊕ EU-gehostet (Komoot-Server in DE)
- ⊕ Strukturierte Antwort mit Postcode, Country, City, Street, Housenumber, lat/lng
- ⊕ Self-Hostable falls Volumen oder Datenschutz das verlangt
- ⊖ Rate-Limit hostbasiert: laut Komoot fair-use, kein hartes Limit dokumentiert; bei Bedarf Self-Hosting
- ⊖ Daten-Aktualität abhängig von OSM-Sync (Komoot updated regelmäßig)

**B — Nominatim (OpenStreetMap-offiziell).**
- ⊕ Kostenlos
- ⊕ Industriestandard
- ⊖ Striktes Rate-Limit: 1 Request/Sekunde pro IP (für Production unrealistisch ohne Self-Hosting)
- ⊖ Weniger fehlertolerant als Photon

**C — Geoapify (kommerziell, Free Tier 3000 Req/Tag).**
- ⊕ EU-Hosting möglich (DE)
- ⊕ Klares Pricing, klare SLA
- ⊖ Vendor-Lock-in
- ⊖ Free Tier reicht für Slice 2, kostet bei Skalierung

**D — Google Places / Mapbox.**
- ⊕ Sehr hohe Datenqualität
- ⊖ USA-Anbieter → DSGVO-Komplexität (Schrems II, Standard-Vertragsklauseln)
- ⊖ Teurer
- ⊖ Lock-in

## Entscheidung

**Option A — Photon.**

Hauptgründe: kostenlos, EU-gehostet, Fehlertoleranz aus dem Mockup-Use-Case („Joachim tippt nach Gehör"), bei Volumen-Explosion problemlos auf Self-Hosting umstellbar (Docker-Image existiert).

## Konsequenzen

### Architektur

- **Backend-Proxy-Endpoint** statt direkter Browser-Call: `GET /api/v1/adressen/suggest?q=<text>&country=de`
  - Vermeidet CORS-Probleme und versteckt Drittanbieter-URL hinterm Backend
  - Erlaubt späteres Switching ohne Frontend-Änderung
  - Server kann Rate-Limit, Caching, Logging zentral machen
- **Server-seitiges Caching** der häufig gesuchten Begriffe (Redis später; in Slice 2 in-memory LRU mit 1000 Einträgen TTL 24h)
- **Photon-Endpoint:** `https://photon.komoot.io/api/?q=<query>&limit=5&lang=de&osm_tag=highway%3Aresidential` — wir filtern auf Adress-Treffer

### Adress-Schema (Slice 2)

```sql
CREATE TABLE adressen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id    UUID NOT NULL REFERENCES mandanten(id) ON DELETE RESTRICT,
  strasse       VARCHAR(200) NOT NULL,
  hausnummer    VARCHAR(32),
  adresszusatz  VARCHAR(100),
  plz           VARCHAR(20) NOT NULL,
  ort           VARCHAR(120) NOT NULL,
  land          CHAR(2) NOT NULL DEFAULT 'DE',  -- ISO-3166-1 alpha-2
  bemerkung     TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  geocode_source VARCHAR(32),                    -- 'photon', 'manual', NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_adressen_plz_ort ON adressen (mandant_id, plz, ort);
```

PLZ-Validierung pro Land im Backend (Pydantic-Custom-Validator + Lookup-Tabelle).

### Datenschutz

- Photon empfängt nur den Such-Begriff, **keine User-ID, keine Geräte-Daten**, kein Auth-Header.
- Wir loggen keine Adress-Such-Queries mit User-Bezug (kein Profiling).
- Falls Joachim sehr sensible Adressen pflegt (z. B. Mieter-Privatadressen mit Schutzwürdigkeit): Photon-Calls bleiben anonym, aber für absolute Sicherheit Self-Hosting empfohlen (Backlog).

### Failure-Modes

- Photon down → Adresse manuell eingeben (Backend gibt leere Liste zurück, kein Hard-Fail)
- Slow Response → Frontend zeigt Loading-Indicator, Timeout 5s
- Wenig oder keine Treffer → User kann Adresse trotzdem speichern (keine Pflicht-Geocodierung)

### Trigger für Wechsel

- Volumen > 10k Requests/Tag → Self-Hosting prüfen
- Datenqualität in Stufe-2-Reportings (Heatmap) reicht nicht → Mapbox/Geoapify
- Joachim verlangt absolutes No-Third-Party → Self-Hosting

## Aufwand

- Backend-Suggest-Endpoint inkl. Tests: ~0,5 PT
- Frontend-Combobox mit Debounce + Vorschlags-Dropdown: ~1 PT
- LRU-Cache + Error-Handling: ~0,5 PT
- **Summe in Slice 2: ~2 PT** (im Adress-Modul-Budget enthalten)

## Bezug

- [Konzept Slice 2](../../01_plan/Konzept_Slice2_UX-Sprung_2026-05-21.md) Abschnitt 9 Punkt 4 + 5
- [ADR 0001 — Plattform-Anker-Strategie](0001-plattform-anker-strategie.md) — Adress-Modul ist Plattform-Kandidat 3
- Photon-API-Docs: <https://photon.komoot.io/>
