# Pattern: Auswahllisten als konfigurierbare Stammdaten

**Plattform-relevant:** ja
**Status:** Konzept aus Mockup, Modul-Skelett für `core/auswahllisten` in Stufe 1.

## Einsatzgebiet

Jede Auswahl mit > 2 Werten, die der Endkunde selbst pflegen oder anpassen können sollte. Status, Prioritäten, Kategorien, Wartet-Gründe, Anlagen, Partner-Typen, Anreden, Kontaktrollen, Dokument-Kategorien, Eingangskanäle, Projekt-Status, Projekttypen.

## Wann anwenden

- Werte sind mandant- oder kundenspezifisch (Joachim hat andere Anlagen-IDs als der nächste Kunde)
- Werte ändern sich über Zeit (neue Kategorie, alte deaktivieren)
- Werte müssen in UI-Dropdowns als auch in Filtern auftauchen
- Werte sollen vom Admin **ohne Code-Änderung** angepasst werden können

## Warum nicht ENUM in der DB

PostgreSQL-ENUMs können nicht ohne `ALTER TYPE` erweitert werden — das ist Migration, kein Stammdaten-Pflege. Bei Auswahllisten muss „neuer Wert hinzufügen" ein normaler INSERT sein.

## Wie umsetzen

**Schema-Pattern:**

```sql
CREATE TABLE auswahlliste_kategorie (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  icon         TEXT,
  farbe        TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE,
  ist_default  BOOLEAN NOT NULL DEFAULT FALSE
);
```

Optional bei „system-rolle"-Listen (Status, Projekt-Status) zusätzlich eine `rolle`-Spalte, die die App-Logik steuert (z. B. `eingang`, `bearbeitung`, `wartend`, `abgeschlossen`).

**Backend-Service-Pattern:**

```python
class AuswahllistenService:
    """Einheitliche CRUD für alle Auswahllisten. Generisch über Tabellen-Name."""
    async def liste(self, key: str) -> list[AuswahlwertOut]: ...
    async def add(self, key: str, wert: AuswahlwertIn): ...
    async def update(self, key: str, id: str, patch: AuswahlwertPatch): ...
    async def deactivate(self, key: str, id: str): ...  # nie hart löschen
```

**Frontend-Pattern:**

```typescript
// Live-Ref auf den aktuellen Stand, von App-Komponente synchronisiert,
// damit Helper außerhalb der Komponente die aktuellen Werte sehen.
let _listenRef = initialAuswahllisten;
function syncListenRef(neu) { _listenRef = neu; }

function getKategorieListe() {
  return [..._listenRef.kategorie.werte]
    .filter((k) => k.aktiv)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}
```

## Eigenschaften

1. **Inaktive Werte bleiben in der DB**, nur `aktiv=false`. Bestehende Datensätze behalten ihren Wert (Audit-Trail).
2. **Default-Wert via `ist_default`-Flag** in der Tabelle, nicht im Code.
3. **Reihenfolge per `reihenfolge`-Spalte**, nicht alphabetisch.
4. **Hard-Delete nur, wenn der Wert nirgendwo referenziert ist.**
5. **Reine Stammdaten-Tabellen haben kein `mandant_id`** (global) — kundenspezifische Werte via `mandant_id` und View.

## Stolperfallen

- **Auswahllisten als JSON-Spalte sind verlockend, aber falsch.** Verknüpfungen (FK zur Auswahlwerte-ID) brechen, Filter werden langsam, Migration unmöglich.
- **Reihenfolge muss explizit gesetzt werden.** Bei Insert nicht „ans Ende" — dafür `max(reihenfolge) + 1` aus der DB lesen.
- **Bei system-rollen-Listen müssen Default-Werte mit der App ausgeliefert werden** (Seed-Migration), sonst läuft die App beim ersten Start ins Leere.

## Verwandt

- [filter-passend-zum-feldtyp.md](filter-passend-zum-feldtyp.md) — Multi-Select-Filter bei Auswahllisten-Spalten
- [konsistente-migration.md](konsistente-migration.md) — bei Feld-Umbenennung alle Stellen mitziehen
