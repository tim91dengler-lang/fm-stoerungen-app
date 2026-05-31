# Konzept: Auswahllisten-Überarbeitung + „wartet-auf"-Integration

> **Projekt:** fm-stoerungen-app (08_FM_ERP_app)
> **Stand:** 2026-05-31
> **Status:** **Konzept freigegeben** (Tim, 2026-05-31, „konzept passt, gerne weiter machen").
> **Auslöser:** Tim-Feedback nach Staging-Test des Ticket-Pools.
> **Autor:** Claude (Konzeptphase)
> **Bezug:** [Konzept_TicketPool_2026-05-31.md](Konzept_TicketPool_2026-05-31.md) §6.2/§10 ·
> CLAUDE.md §4 (Listen-Konvention), Memory `auswahllisten-default`

---

## 1. Befund (Ist-Stand)

- **System-Listen voll gesperrt:** Für `ticket_status`, `wartet_grund`, `eingangskanal`,
  `ticket_prioritaet`, `projektstatus` lässt das UI **kein** Hinzufügen/Bearbeiten/Löschen zu
  (`!liste.ist_system`-Gate). Backend `update_wert`/`update_liste` werfen bei System-Einträgen
  `403`.
- **Keys manuell:** Beim Anlegen eines Werts tippt man den technischen Key selbst.
- **Kein Aktiv-Toggle** im Werte-Editor (obwohl `ist_aktiv` im Modell existiert).
- **„wartet auf"** wird heute auf einer **separaten** Status-Workflow-Seite konfiguriert
  (Hook + Übergangsmatrix) — nicht dort, wo man die Status pflegt.
- **Wartet-Kontakt** = freie Texteingabe (Name/Tel/Mail), kein Partner-Bezug.

## 2. Überarbeitung — einheitlicher Werte-Editor (für ALLE Listen)

1. **Auto-ID:** Key wird beim Anlegen automatisch aus dem Label slugifiziert (kein Tippen);
   optional aufklappbar manuell editierbar. Nach dem Speichern bleibt der Key stabil.
2. **Aktiv-Toggle** je Wert: inaktive Werte verschwinden aus den Dropdowns, bleiben aber an
   Alt-Tickets erhalten (kein Datenverlust).
3. **Löschen** je Wert (mit Bestätigung) — nur für **eigene** Werte. **System-Werte:** nicht
   löschbar, aber **deaktivierbar**.
4. **Reihenfolge** je Wert per ↑/↓ änderbar.
5. **System-Listen werden pflegbar:** Label/Farbe/Reihenfolge/Aktiv änderbar + **eigene Werte
   hinzufügbar** (z. B. ein neuer Status). Nur der technische Key der mitgelieferten System-Werte
   bleibt fix, und mitgelieferte System-Werte bleiben **unlöschbar** (nur deaktivierbar).
   → braucht eine **Lockerung** des Backend-System-Schutzes: **Key + Löschen geschützt, Rest erlaubt.**

## 3. „wartet auf" in die Status-Liste integrieren

- Der **„erfordert Sub-Grund"-Hook** (heute `meta.erfordert_grund`, gepflegt auf der separaten
  Status-Workflow-Seite) bekommt im **Status-Werte-Editor** ein Häkchen „verlangt Wartet-Grund"
  pro Status-Wert. So pflegt man ihn direkt dort, wo die Status leben.
  *Technik:* das Häkchen schreibt `meta.erfordert_grund` **merge-erhaltend** (die
  `erlaubte_uebergaenge` im selben `meta` bleiben unangetastet).
- Die **Sub-Gründe** (`wartet_grund`-Liste) bleiben eine eigene Liste, im selben überarbeiteten
  Editor pflegbar.
- **Übergangsmatrix** bleibt auf der dedizierten Status-Workflow-Seite (das Von×Nach-Raster passt
  nicht in eine Listen-Zeile) — von der Status-Liste aus verlinkt.

## 4. Wartet-Kontakt = Geschäftspartner-Picker

- In der Wartet-Sektion des Tickets wird der Kontakt/Nachunternehmer über einen **such-/tippbaren
  Geschäftspartner-Picker** gewählt (`PartnerSearchSelect`-Muster, Server-Suche, auch bei 500+
  Partnern) — **Single-Select**.
- Bei Auswahl werden **Ansprechpartner/Telefon/E-Mail aus dem Partner-Stamm vorbefüllt** und
  bleiben pro Ticket überschreibbar (Ticket-Konzept §5.6).
- **Kein neues DB-Feld:** der Picker setzt das bestehende `wartet_nachunternehmer_id` und füllt die
  vorhandenen Kontaktfelder.

## 5. Entscheidungen (Tim, 2026-05-31)

| # | Thema | Entscheidung |
|---|---|---|
| A | System-Werte editierbar (Backend-Schutz lockern)? | **Ja** — Label/Farbe/Reihenfolge/Aktiv/meta erlaubt; **Key + Löschen bleiben geschützt** |
| B | Ort der Übergangsmatrix | **Bleibt eigene Seite**; nur der „wartet-auf"-Hook wandert in die Status-Liste |
| C | Wartet-Kontakt: welche Partner-Typen? | **Alle** Geschäftspartner durchsuchbar (nicht nur Nachunternehmer) |

## 6. Umsetzungsschnitt (2 PRs)

1. **Überarbeiteter Werte-Editor** — Auto-ID, Aktiv-Toggle, Löschen, Reorder, System-Listen
   pflegbar (Backend-Schutz gelockert: Key + Löschen geschützt) + „erfordert-Grund"-Hook in der
   Status-Liste.
2. **Wartet-Kontakt-Partner-Picker** mit Autofill von Name/Telefon/E-Mail; setzt
   `wartet_nachunternehmer_id`, kein neues DB-Feld.

---

*Konzept zuerst. Freigegeben 2026-05-31 — Umsetzung in den zwei genannten PRs.*
