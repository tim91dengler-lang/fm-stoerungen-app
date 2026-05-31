# Konzept: Ticket-Ausbau — Kontakte, Such-Picker, Quick-Wins, Rich-Text

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-05-31
> **Status:** Freigegeben (Richtungs- und Reihenfolge-Entscheidungen mit Tim getroffen, s. §7).
> **Autor:** Claude (Konzeptphase)
> **Bezug:** `docs/concepts/Konzept_TicketDetail_UX_2026-05-31.md` · `docs/plan.md` §5.4 (Zuordnung) ·
> CLAUDE.md §4 (Listen-Konvention, Auswahllisten-Default) · Memory `auswahllisten-default`

---

## 1. Auslöser

Nach der Ticket-Detail-UX-Reihe (#109 Layout, #110 Blöcke, #111 mehrere Pins) hat Tim sechs weitere
Anforderungen am Ticket-Objekt benannt. Dieses Konzept schneidet sie, trifft die offenen
Architektur-Entscheidungen und legt die Umsetzungsreihenfolge fest.

## 2. Die sechs Punkte (Soll)

| # | Punkt | Kern |
|---|---|---|
| ① | **Kontakte / Beteiligte** | Mehrere Parteien je Ticket: Geschäftspartner **+** zugeordneter Ansprechpartner, Hauptkontakt vorbelegt, E-Mail/Telefon/Mobil direkt anklickbar. |
| ② | **Titel editierbar** | Titel auch im geöffneten Ticket nachträglich änderbar (inline im Kopf). |
| ③ | **Chat oben rechts** | Chat prominent an den Kopf der rechten Spalte (sticky), nicht weit unten. |
| ④ | **Rich-Text-Beschreibung** | Bilder per Copy/Paste (Strg+V) direkt in den Beschreibungs-Fließtext. |
| ⑤ | **Such-Picker überall** | Tippgesteuerte Suche in allen Bewegungsdaten-Feldern (Partner 10k–100k, Objekte/Projekte je Hunderte). |
| ⑥ | **Datumsfelder + Kalender** | Fälligkeit sichtbar, optional Zeitraum (von/bis), Filter nach Datum. |

## 3. Ist-Zustand (im Code geprüft, 2026-05-31)

- **Kontakte:** Ticket trägt genau **ein** `partner_id` (FK) + freien Text `melder` + die drei
  `wartet_kontakt_{name,telefon,email}`-Strings (für den Nachunternehmer beim „Wartet auf"-Status).
  Kein n:m, keine Ansprechpartner-Zuordnung am Ticket.
- **Ansprechpartner-Stammdaten existieren bereits:** `PartnerKontakt` (Tabelle `partner_kontakte`)
  mit `ist_hauptkontakt`, `email`, `telefon`, `mobil`, FK auf `GeschaeftsPartner`. → Datenmodell für
  die Kontakte-Zuordnung ist da, muss nur am Ticket angedockt werden.
- **Such-Picker:** Das Anlege-Formular lädt heute via `…list({ limit: 500 })` bis zu 500 Datensätze in
  ein Client-Dropdown — **bricht bei 10k–100k Partnern.** Aber: die List-Endpoints für **Partner,
  Objekt, Projekt, Anlage, Fehlercode** unterstützen serverseitiges `?search=` bereits. Komponenten
  `PartnerSearchSelect`, `MultiSelectCombobox`, `AdresseSearchSelect` existieren als Vorlage.
  → ⑤ ist überwiegend **Frontend**: Dropdowns auf Async-Suche umstellen, kein Backend-Neubau.
- **Beschreibung:** `beschreibung` ist reiner `Text`. Kein Rich-Text, keine Inline-Bilder.
- **Datum:** `faelligkeit_am` (`Date`, indexiert) existiert im Modell, ist aber im UI nicht als Feld
  geführt.
- **Chat:** liegt als Block unten im Detail-Panel (nach der PR-2-Block-Reihenfolge).

## 4. Soll-Konzept je Punkt

### ① Kontakte / Beteiligte — flexible Liste (Entscheidung A)
Neue n:m-Verknüpfung **Ticket ↔ Geschäftspartner** (Tabelle `ticket_beteiligte`), je Zeile:
- **Rolle** als **Auswahlliste** `beteiligten_rolle` (Seed: Melder, Auftraggeber, Mieter vor Ort,
  Nachunternehmer, Hausverwaltung …) — konfigurierbar, nicht hardcoded (Memory `auswahllisten-default`).
- FK `partner_id` (Pflicht) + optionaler FK `partner_kontakt_id` (Ansprechpartner).
- `ist_hauptkontakt`-Flag (genau einer je Ticket vorbelegt/markierbar).
- **Kontaktdaten read-only aus dem Stamm gezogen** (Ansprechpartner → Fallback Partner): E-Mail,
  Telefon, Mobil — im UI als **`mailto:` / `tel:`**-Direktaktionen.

**Migration/Bestand:** der heutige `partner_id` + `melder` werden in eine Beteiligten-Zeile
(Rolle „Melder") überführt; der `wartet_kontakt_*`-Block bleibt funktional an der Wartet-Logik, wird
aber perspektivisch als Beteiligter mit Rolle „Nachunternehmer" abgebildet (Expand-only: Alt-Felder
zunächst behalten, deploy-sicher).

**Vorlagen-Designer:** „Beteiligte" wird ein zuschaltbares Block-Feld (▣) im Feld-Katalog.

### ② Titel editierbar
Titel im Kopf **inline editierbar** (Klick/Stift → Feld → `PATCH titel`). Klein.

### ③ Chat oben rechts
Im Desktop-2-Spalten-Layout wandert der Chat an den **Kopf der rechten Spalte (sticky)**; mobil bleibt
er ein normaler Block in Techniker-Reihenfolge. Berührt die PR-2-Block-/Order-Logik — sorgfältig.

### ④ Rich-Text-Beschreibung mit Bild-Paste — **zuletzt, isoliert**
Editor **TipTap/ProseMirror**. Bilder per Paste/Drop → Upload in **Object-Storage**
(Foto-Upload-Infra wiederverwenden), Referenz im Dokument. Speicherung als **serverseitig bereinigtes
HTML** (Sanitizing = **Pflicht**, XSS-Schutz; DSGVO/Security-by-design, CLAUDE.md §6). Migration
plain-text → HTML (Bestand bleibt als Absatz erhalten). Schwerster + sicherheitskritischster Punkt.

### ⑤ Such-Picker in allen Bewegungsdaten-Feldern — **zuerst**
Generische **AsyncSearchSelect**-Komponente (debounced `?search=`, serverseitig paginiert) statt
`limit:500`-Dropdown. Verdrahten für **Partner, Objekt, Projekt, Anlage, Fehlercode** im Anlege-Modal
**und** im Detail-Panel. Backend-Suche existiert; ggf. kleine Ergänzungen (Limit/Sort).
Hoher Wert, entschärft Skalierung, und ① baut darauf auf.

### ⑥ Datumsfelder + Filter (kein echter Kalender, Entscheidung C)
`faelligkeit_am` als **sichtbares, editierbares** Feld (vorlagen-schaltbar). Optional **Zeitraum**
`termin_von`/`termin_bis` als zuschaltbare Felder. Liste nach Datum **filter-/sortierbar**. Eine
visuelle Kalender-/Agenda-Ansicht ist bewusst **Follow-up** (nicht in diesem Schnitt).

## 5. Verknüpfungsmodell (Delta)

```
   Geschäftspartner ─1:n─▶ PartnerKontakt (Ansprechpartner, ist_hauptkontakt)
        ▲                        ▲
        │ partner_id             │ partner_kontakt_id (optional)
   ┌──────────────────────────────────┐
   │        ticket_beteiligte          │  n:m  + rolle (Auswahlliste) + ist_hauptkontakt
   └──────────────────────────────────┘
                  │ ticket_id
              ┌────────┐
              │ TICKET │  + faelligkeit_am (sichtbar), termin_von/bis (opt.), beschreibung→HTML (④)
              └────────┘
```
Delete-Verhalten Beteiligte: Ticket CASCADE; Partner/Kontakt RESTRICT bzw. SET NULL auf
`partner_kontakt_id`.

## 6. Umsetzungsreihenfolge (freigegeben)

1. **⑤ Such-Picker** (Fundament; entsperrt 10k–100k-Skalierung) — überwiegend Frontend.
2. **① Kontakte-Block** (nutzt den Picker; neue Tabelle + Migration + Block-UI).
3. **Quick-Wins gebündelt:** ② Titel-Edit · ③ Chat oben rechts · ⑥ Datumsfelder sichtbar + Filter.
4. **④ Rich-Text-Beschreibung mit Bild-Paste** (schwer, sicherheitskritisch, isoliert).

Jeder Schritt = eigene(r) kleine(r) PR(s), Selbsttest (E2E) vor Acceptance, Merge auf grüner CI
(Merge-Verantwortung CLAUDE.md §7).

## 7. Entscheidungen (Tim, 2026-05-31)

- **A — Kontakte:** **flexible Beteiligten-Liste** (n:m + Rolle), nicht feste Felder.
- **B — Start/Reihenfolge:** **Such-Picker zuerst**, dann Kontakte, dann Quick-Wins, dann Rich-Text.
- **C — Kalender:** **nur Datumsfelder + Filter** jetzt; echte Kalenderansicht später.

## 8. Offen / später

- Echte Kalender-/Agenda-Ansicht (Follow-up zu ⑥).
- Vollständige Ablösung von `wartet_kontakt_*` durch Beteiligte (nach ① stabilisiert).
- Pflichtfeld-/Sichtbarkeits-Defaults der Beteiligten je Start-Vorlage → mit Joachim (Mustervorlage).

---

*Konzept zuerst. Richtung freigegeben — Umsetzung in der Reihenfolge aus §6, je Schritt eigener PR.*
