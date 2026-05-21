# Pull Request

## Was ändert dieser PR?

<!-- 1–3 Sätze: was, warum, in welcher Stufe -->

## Slice / Issue

<!-- Verweis auf Vertical Slice oder Issue, z. B. "Slice 2 — Tickets anlegen" -->

## 12-Punkte-Selbstreview-Checkliste (Pflicht — siehe Tech-Spec Kapitel 10.4)

- [ ] Tests für neue/geänderte Logik vorhanden (Unit + Integration wo passend)
- [ ] Auth-Decorator / Permission-Check auf jedem geänderten Endpoint vorhanden
- [ ] User-Input wird validiert (pydantic / Zod-Schema)
- [ ] Keine Secrets oder Debug-Outputs im Code
- [ ] DB-Migration vorhanden und mit Rollback-Skript getestet
- [ ] Audit-Log für relevante Schreiboperationen erweitert
- [ ] Frontend-Strings auf Deutsch (kein hardcoded Englisch)
- [ ] Mobile / Touch-Bedienbarkeit für UI-Änderungen geprüft
- [ ] Feature-Flag gesetzt, falls Risiko-Feature
- [ ] Doku / ADR aktualisiert bei Architektur-Änderung
- [ ] OpenAPI-Spec aktualisiert bei API-Änderung
- [ ] Manueller Smoke-Test auf Staging durchgeführt

## Risiko-Hinweise

<!-- Was könnte schiefgehen? Welche Tests fehlen ggf.? Wo sollte Tim besonders genau prüfen? -->

## Screenshot / Demo

<!-- bei UI-Änderungen: Screenshot oder kurzes GIF aus Staging -->
