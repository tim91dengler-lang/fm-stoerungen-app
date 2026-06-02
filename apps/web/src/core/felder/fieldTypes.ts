/**
 * Feldtyp-Taxonomie — Fundament der Feldtyp-Registry (ADR 0006, Phase 2).
 *
 * Ein Feldtyp bündelt, WIE ein Feld über alle Oberflächen gerendert/gefiltert wird
 * (Erfassen · Detail-Inline · Vorschau · Listen-Zelle · Filter). Heute steckt der Typ
 * implizit im `feld_key` + hartcodierten Renderern; dieser Katalog macht ihn explizit,
 * damit ein neuer Feld-Standard an EINER Stelle gepflegt wird.
 *
 * Entscheidung (ADR 0006): Option C — Typ lebt vorerst im Frontend (dieser Katalog),
 * kein Backend-Attribut. Sobald nutzerdefinierte Felder kommen, wird `TickettypFeld.feldtyp`
 * (Option B) zur Quelle, die diesen Katalog ablöst.
 */

export type FieldType =
  | 'text' // einzeiliger Text (titel)
  | 'longtext' // mehrzeilig (beschreibung)
  | 'date' // ISO-Datum YYYY-MM-DD → DatePicker / Datum-Vergleich
  | 'select' // Single-Select aus Auswahlliste/Enum (kategorie, quelle, wiederholung)
  | 'multiselect' // Mehrfach-Auswahl
  | 'entity_ref' // Such-Referenz auf andere Entität (objekt, anlage, projekt, fehlercode)
  | 'number'
  | 'boolean'
  | 'badge_enum' // Auswahl mit farbigem Badge (prio, status)
  | 'custom'; // Verbund-/Spezialfeld: bespoke Widget, kein generisches Schema

/** Typen, die ein generisches Schema haben (Registry liefert Renderer/Filter). */
export function isGenericType(t: FieldType): boolean {
  return t !== 'custom';
}

/**
 * Ticket-Feld → Feldtyp (korrespondiert mit Backend `DEFAULT_SYSTEM_FELDER`).
 *
 * `custom` = bewusst bespoke (Notausgang, keine Schein-Generalisierung):
 * - partner (Beteiligte-Block), pin (Grundriss), foto, dokumente, adresse,
 * - die Objekt→Haus→Stockwerk→Einheit-Kaskade (abhängige Selects).
 */
export const TICKET_FELD_TYPES: Record<string, FieldType> = {
  titel: 'text',
  beschreibung: 'longtext',
  faelligkeit_am: 'date',
  wiederholung: 'select',
  kategorie: 'select',
  quelle: 'select',
  prio: 'badge_enum',
  objekt: 'entity_ref',
  anlage: 'entity_ref',
  projekt: 'entity_ref',
  fehlercode: 'entity_ref',
  // bewusst bespoke:
  partner: 'custom',
  pin: 'custom',
  foto: 'custom',
  dokumente: 'custom',
  adresse: 'custom',
  haus: 'custom',
  stockwerk: 'custom',
  einheit: 'custom',
};

/** Feldtyp eines Ticket-Feldes (Fallback `custom`, falls unbekannt). */
export function ticketFeldType(feldKey: string): FieldType {
  return TICKET_FELD_TYPES[feldKey] ?? 'custom';
}
