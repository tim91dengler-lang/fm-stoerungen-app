/**
 * Schlanke Feature-Flags für den schrittweisen Master-Layout-Roll-out.
 *
 * `modul_standard` schaltet das neue Modul-Layout (zentriertes Detail-Overlay
 * statt Detail-Seite) modulweise frei — Default AUS, Bestehendes bleibt unberührt,
 * bis Tim das Referenz-Modul abnimmt. Umschalten ohne Rebuild:
 *   per Konsole:  localStorage.setItem('ff_modul_standard','1')
 *   oder per Link: ?ff_modul_standard=1   (wird in localStorage übernommen)
 */
const KEY = 'ff_modul_standard';
const truthy = (v: string | null): boolean => v === '1' || v === 'true';

export function isModulStandard(): boolean {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(KEY);
    if (fromUrl !== null) {
      const next = truthy(fromUrl) ? '1' : '0';
      if (window.localStorage.getItem(KEY) !== next) {
        window.localStorage.setItem(KEY, next);
      }
    }
    return truthy(window.localStorage.getItem(KEY));
  } catch {
    return false;
  }
}
