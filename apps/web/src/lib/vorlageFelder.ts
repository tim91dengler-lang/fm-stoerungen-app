import type { TickettypFeldRead, TickettypRead } from '../api/types';

/**
 * Geteilte Helfer für das vorlagengetriebene Ticket: welche Felder eine
 * Vorlage (Tickettyp) sichtbar/Pflicht macht. Eine Quelle für Anlege-Modal
 * (TicketErfassenModal) und Detail-Panel (TicketDetailPanel) — verhindert
 * Drift zwischen den beiden Stellen, die das Feld-Set rendern.
 *
 * Fallback ohne Vorlage: alles sichtbar, nichts Pflicht (gilt z. B. für
 * Alt-Tickets ohne `tickettyp_id`).
 */
export function buildFelderMap(
  typ: Pick<TickettypRead, 'felder'> | null,
): Map<string, TickettypFeldRead> {
  const m = new Map<string, TickettypFeldRead>();
  if (!typ) return m;
  for (const f of typ.felder) m.set(f.feld_key, f);
  return m;
}

export interface VorlageFelderHelfer {
  /** Map feld_key -> Feld-Konfig (sichtbar/pflicht/reihenfolge). */
  map: Map<string, TickettypFeldRead>;
  /** Sichtbar, wenn die Vorlage das Feld führt und sichtbar=true. Ohne Vorlage: true. */
  sichtbar: (feldKey: string) => boolean;
  /** Pflicht nur, wenn das Feld sichtbar UND pflicht ist. */
  pflicht: (feldKey: string) => boolean;
}

export function vorlageFelder(typ: TickettypRead | null): VorlageFelderHelfer {
  const map = buildFelderMap(typ);
  return {
    map,
    sichtbar: (feldKey: string) => {
      if (!typ) return true;
      const f = map.get(feldKey);
      return f ? f.sichtbar : true;
    },
    pflicht: (feldKey: string) => {
      const f = map.get(feldKey);
      return f ? f.pflicht && f.sichtbar : false;
    },
  };
}
