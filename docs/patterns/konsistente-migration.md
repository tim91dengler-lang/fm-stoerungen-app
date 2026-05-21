# Pattern: Konsistente Migration bei Feld-Änderungen

**Plattform-relevant:** ja
**Status:** Konzept aus Mockup (Lessons Learned von Feld-Umbenennungen).

## Einsatzgebiet

Jede Änderung an einem Feld eines Stammdatensatzes oder Tickets — Umbenennen, Typ-Wechsel, neue Pflicht, Wertebereich-Anpassung.

## Regel

Bei jeder Feld-Änderung **alle Referenzen** finden und mitziehen — in einem einzigen Pull Request:

1. **Datenmodell / Schema** (DDL, Migration)
2. **Backend-API** (pydantic-Models, OpenAPI-Spec)
3. **Frontend-Formulare** (Anlegen-Modal, Bearbeiten-Modal)
4. **Anzeige-Komponenten** (Detail-Panel, Listen-Spalten, Mobile-Detail)
5. **Filter-Definitionen** (Spalten-Filter, Volltextsuche)
6. **Spalten-Konfiguration** (`SPALTEN_DEFINITION`, Default-Sichtbarkeit)
7. **Bulk-Edit-Editoren** (falls feldspezifisch)
8. **Power-Layout-Sortier-/Gruppier-Logik** (`sortValueOf`, `gruppenLabelFor`)
9. **Vorlagen** (Tickettyp-`systemFelder`, falls feldspezifisch)
10. **PDF/CSV-Export** (falls vorhanden)
11. **Audit-Log-Format** (System-Audit-Payload, ticket_verlauf-Texte)
12. **Print-Vorlagen** (HTML-Druck)

## Wie umsetzen

**Vor dem PR eine Checkliste durchgehen:**

```bash
# Beispiel: Umbenennung dienstleister → nachunternehmer
rg -i "dienstleister" apps/ docs/ packages/  # alle Vorkommen
rg "typIds.*dienstleister" packages/shared/
rg "DIENSTLEISTER" .                          # Konstanten
```

**Nichts in einem PR vergessen:** lieber alle 12 Punkte explizit als „nicht relevant" markieren, als einen übersehen.

## Stolperfallen

- **Konstanten-Mapping wie `LABELS = { ... }` werden gerne übersehen** — Grep über Label-Text, nicht nur Field-Name.
- **TypeScript schweigt bei Feld-Renames in `JSON`-Spalten** — bei `customValues: jsonb` muss man manuell suchen.
- **Stale-Tests** prüfen oft gegen alte Feld-Namen — Tests in einem PR mit migrieren, nicht nachschieben.
- **Print-Vorlagen sind oft separat geparst** — eigene Test-Suite für Druck-Output.
- **Mobile-UI ist ein separater Code-Pfad** — bei Mockup-Phase oft vergessen.

## Lessons-Learned aus Mockup-Phase

Beim Umbenennen von `dienstleister` → `nachunternehmer` (auf Joachims Wunsch im 2. Termin) waren ~14 Stellen betroffen über alle 7 Listenansichten. In Stufe 1 mit echten Daten würde Stale-State zu Bugs führen (z. B. Filter zeigt nichts mehr).

**Konsequenz für Stufe 1:** Bei jeder Feld-Migration:
1. Migration-Script schreibt **alte und neue Werte parallel** (Übergangsphase)
2. Code wird umgestellt
3. Datenmigration befüllt neue Felder aus alten
4. Alte Felder werden **erst nach 1 Release** entfernt (Rollback-Sicherheit)

## Verwandt

- [auswahllisten-default.md](auswahllisten-default.md) — Wert-Renames in Auswahllisten via Migration
