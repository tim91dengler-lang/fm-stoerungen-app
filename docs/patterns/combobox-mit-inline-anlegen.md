# Pattern: Combobox mit Inline-Anlegen

**Plattform-relevant:** ja
**Status:** Konzept aus Mockup. Implementation in `core/auswahllisten/Combobox`.

## Einsatzgebiet

Jede Auswahl, bei der der User „nicht in der Liste? Direkt neu anlegen!"-Bedürfnis hat. Adressen, Geschäftspartner, Anlagen, Fehlercodes, Kategorien.

## Idee

Combobox mit Search-Eingabe + Dropdown-Liste. **Unten in der Liste** ein „+ Neue Adresse anlegen"-Button, der ein Mini-Modal oder Inline-Form öffnet, ohne den Anlegen-Workflow zu unterbrechen.

## Wie umsetzen

```tsx
<AuswahlCombobox
  value={form.adresseId}
  onChange={(id) => setForm({ ...form, adresseId: id })}
  options={adressen.map((a) => ({ id: a.id, label: formatAdresse(a) }))}
  placeholder="Adresse wählen oder anlegen …"
  onCreate={(eingabe) => {
    // Optional: vorgeschlagene Werte aus der Suche übernehmen
    setNewAdresseDefault({ strasse: eingabe });
    setNewAdresseOpen(true);
  }}
  createLabel="Neue Adresse anlegen"
/>
{newAdresseOpen && (
  <AdresseModal
    adresse={newAdresseDefault}
    onClose={() => setNewAdresseOpen(false)}
    onSave={(neu) => {
      setAdressen((prev) => [...prev, neu]);
      setForm({ ...form, adresseId: neu.id });   // direkt zugewiesen
      setNewAdresseOpen(false);
    }}
  />
)}
```

## Eigenschaften

1. **Such-Input löst Filter aus**, nicht erst beim Klick.
2. **„+ Neu anlegen"-Button bleibt sichtbar** auch wenn die Suche keine Treffer hat — wichtig für „in der Liste? nein, ich tippe weiter und lege an".
3. **Nach Anlegen wird der neue Datensatz direkt im Form-Feld gesetzt** — kein zweiter Klick nötig.
4. **Vorgeschlagene Werte** aus der Sucheingabe ins neue Modal übernehmen (Beispiel: User tippt „Mainzer Landstraße", klickt „+ Neu" → Modal öffnet mit `strasse="Mainzer Landstraße"`).

## Stolperfallen

- **Modal vs. Inline-Form:** Bei einfachen Entitäten (Anlage, Kategorie) Inline-Form ausreichend. Bei komplexen (Adresse, Partner mit Kontakten) eigenes Modal.
- **Berechtigung:** „+ Neu anlegen"-Button nur sichtbar, wenn User Recht hat (`stammdaten.adresse.anlegen`).
- **Race-Condition bei Mehrbenutzer:** anderer User legt parallel an, Liste muss live aktualisieren (in Stufe 1 via Polling, Stufe 2 via WebSocket).

## Verwandt

- [auswahllisten-default.md](auswahllisten-default.md) — Combobox-Datenquelle
- [power-layout.md](power-layout.md) — Combobox als Filter-Element
