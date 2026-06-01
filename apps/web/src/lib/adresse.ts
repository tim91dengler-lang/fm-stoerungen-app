import type { AdresseRead } from '../api/types';

/** Adresse einzeilig: „Straße Nr, PLZ Ort". */
export function formatAdresse(a: AdresseRead): string {
  const strasse = [a.strasse, a.hausnummer].filter(Boolean).join(' ');
  const ort = [a.plz, a.ort].filter(Boolean).join(' ');
  return [strasse, ort].filter(Boolean).join(', ');
}

/** Google-Maps-Such-URL — Koordinaten bevorzugt (präziser), sonst Adress-String. */
export function mapsUrl(a: AdresseRead): string {
  const query =
    a.latitude != null && a.longitude != null
      ? `${a.latitude},${a.longitude}`
      : formatAdresse(a);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
