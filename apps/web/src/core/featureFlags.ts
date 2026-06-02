/**
 * Schlanke Feature-Flags für den schrittweisen Master-Layout-Roll-out.
 *
 * `modul_standard` schaltet das neue Modul-Layout (zentriertes Detail-Overlay
 * statt Detail-Seite) modulweise frei. Präzedenz: URL/localStorage (pro Browser)
 * → Build-Env `VITE_MODUL_STANDARD` (auf Staging =1, damit Tim das Neue ohne
 * Umschalten sieht; Code-Default AUS, Prod-Default bliebe aus). Umschalten ohne
 * Rebuild: `?ff_modul_standard=1` (wird in localStorage übernommen) bzw. `…=0`.
 */
const KEY = 'ff_modul_standard';
const truthy = (v: string | null | undefined): boolean => v === '1' || v === 'true';

export function isModulStandard(): boolean {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(KEY);
    if (fromUrl !== null) {
      const next = truthy(fromUrl) ? '1' : '0';
      if (window.localStorage.getItem(KEY) !== next) {
        window.localStorage.setItem(KEY, next);
      }
    }
    const stored = window.localStorage.getItem(KEY);
    if (stored !== null) return truthy(stored);
  } catch {
    /* localStorage nicht verfügbar — Build-Env-Default unten */
  }
  return truthy(import.meta.env.VITE_MODUL_STANDARD);
}
