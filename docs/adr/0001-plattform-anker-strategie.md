# ADR 0001 — Plattform-Anker-Strategie: Plattform-Ready, nicht Plattform-Aktiv

- **Status:** Akzeptiert
- **Datum:** 2026-05-20
- **plattform-relevant:** ja (gilt für alle künftigen Apps)

## Kontext

Das FM-Ticketsystem ist Tims erste „eigene Produkt"-Anwendung im Sinne seiner langfristigen Plattform-Vision (mehrere Apps mit gemeinsamem Kern). Frage zum Start: bauen wir die App als reines Joachim-Produkt, als sofortige Voll-Plattform oder als Mittelweg?

## Optionen

**A — Voll-Plattform jetzt:** Monorepo mit publishbaren npm-/PyPI-Paketen ab Tag 1, generische Konfig-Schicht, „Configurable Everything"-Architektur.
- ⊕ Zweite App startet auf ~30 % Aufwand
- ⊖ +40–50 % Mehraufwand auf Stufe 1
- ⊖ Premature Generalization — wir wissen noch nicht, was die zweite App wirklich braucht

**B — Komplett nachgelagert:** Joachim-App spezifisch bauen, später extrahieren.
- ⊕ Stufe 1 schlank
- ⊖ +30–50 PT Extraktion später + Tight-Coupling-Schulden
- ⊖ Bei knapper Zeitlinie wird die Extraktion verschoben → passiert nie

**C — Plattform-Ready, nicht Plattform-Aktiv:** Architektur-Disziplin + Pattern-Library jetzt, npm-Pakete erst wenn die zweite App es ernsthaft braucht („Rule of Three").
- ⊕ +10–15 % Stufe 1
- ⊕ Bootstrap zweite App ~30–50 %
- ⊕ Patterns wachsen kontrolliert, keine Premature Generalization

## Entscheidung

**Option C** (Tim, 2026-05-20).

## Konsequenzen

### Was wir tun

1. **Bounded Contexts** ab Tag 1 trennen: `core/` (wiederverwendbar, FM-frei) vs. `fm-tickets/` (anwendungsspezifisch). ESLint-/Import-Lint-Regel verbindlich, CI bricht bei Verstoß. Siehe [Pattern: Bounded-Context-Trennung](../patterns/bounded-context-trennung.md).

2. **Pattern-Library** in [`docs/patterns/`](../patterns/) als Wachsendes Wissens-Repository. Pflegeregel „Rule of Three": Wer ein Pattern zum dritten Mal kopiert, schreibt es als Pattern-Datei aus.

3. **ADRs mit `plattform-relevant`-Marker** — jedes ADR trägt `plattform-relevant: ja|nein` plus Begründung. „Ja" bedeutet: die Entscheidung gilt nicht nur für die FM-App, sondern als Default für künftige Apps.

4. **10 Plattform-Kandidaten-Module** mit besonderer API-Disziplin:
   - `liste` (`usePowerLayout`-Hook + Komponenten)
   - `auswahllisten` (Engine + UI)
   - `adresse` (CRUD + Combobox + Modal + Validation)
   - `partner` (Geschäftspartner mit n:m-Typen, n-Kontakten)
   - `benutzer` (Benutzer + Rolle)
   - `audit` (`system_audit`-Trigger + UI-Anzeige)
   - `rbac` (Rechte-Prüfung, `useRechte`-Hook)
   - `notifications` (In-App-Toast, Bell-Dropdown, Push)
   - `llm-gateway` (Pseudonymisierung, Modell-Router, Prompt-Library, Cost-Tracker)
   - `dokumente` (CRUD, Drag-Drop-Zone, `.msg`-Parser, n:m-Verknüpfungs-Engine)

   Pro Modul: stabile Schnittstelle, FM-freie Implementierung, eigene Tests ohne FM-Fixtures, ADR bei nicht-trivialen Schnittstellen-Entscheidungen.

### Was wir bewusst NICHT tun

- Echte Monorepo-Distribution mit publishbaren npm-Packages
- Generische Konfigurations-Schicht („App auf Code-Level konfigurieren statt anpassen")
- Externe Komponenten-Library zur Distribution (Storybook ja, aber primär als Doku)
- Multi-App-Mandantenfähigkeit zur Laufzeit (eine Instanz pro Mandant reicht für Stufe 1+2)

### Trigger für Wechsel zu Plattform-Aktiv (= Stufe 3)

1. Zweite zahlende Software-Anwendung in Sicht
2. Drittes Mal Power-Layout extrahiert — Pattern hat sich bewährt
3. Drittes Mal Adress-Modul kopiert — Schnittstelle ist stabil
4. Externe Devs / Junior-Entwickler im Team — Wartbarkeit per Library wichtiger als per Konvention

Bis dahin: Disziplin reicht, Distribution ist Overkill.

## Aufwand

- Stufe 1: ~+8 PT (Bounded Contexts, Pattern-Library, ADR-Disziplin, Lint-Regeln)
- Bootstrap zweite App: ~30–50 % statt 100 %

## Bezug

- Tech-Spec [`docs/tech-spec.md`](../tech-spec.md) Kapitel 13
- Pattern [`docs/patterns/bounded-context-trennung.md`](../patterns/bounded-context-trennung.md)
- Pattern-Library [`docs/patterns/`](../patterns/)
