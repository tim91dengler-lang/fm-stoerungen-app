import type { AuswahllistenWertRead } from '../api/types';

/**
 * Werte für ein Auswahl-Dropdown: nur aktive Werte, plus den aktuell gesetzten
 * Wert (auch wenn inaktiv), damit ein an einem Alt-Ticket bereits gewählter,
 * inzwischen deaktivierter Wert nicht aus der Auswahl verschwindet.
 *
 * Anzeige-/Label-Lookups (z. B. Badges) nutzen weiterhin ALLE Werte, damit
 * historische Werte stets auflösbar bleiben (Konzept Auswahllisten-Überarbeitung §2.2).
 */
export function aktiveWerte(
  werte: AuswahllistenWertRead[] | undefined,
  currentKey?: string | null,
): AuswahllistenWertRead[] {
  return (werte ?? []).filter(
    (w) =>
      w.ist_aktiv || (currentKey != null && currentKey !== '' && w.key === currentKey),
  );
}
