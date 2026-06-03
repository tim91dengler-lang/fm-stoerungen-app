import { MapPin } from 'lucide-react';

import type { AdresseRead } from '../api/types';
import { mapsUrl } from '../lib/adresse';

/**
 * Klickbarer „Auf Karte öffnen"-Link (Google Maps) für eine Adresse.
 * Wiederverwendbarer Standard — überall wo eine Adresse angezeigt wird.
 */
export function MapsLink({
  adresse,
  className,
}: {
  adresse: AdresseRead | null | undefined;
  className?: string;
}) {
  if (!adresse) return null;
  return (
    <a
      href={mapsUrl(adresse)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Auf Google Maps öffnen"
      className={`inline-flex items-center gap-1 text-xs text-emerald-400 transition-colors hover:text-emerald-300 ${className ?? ''}`}
    >
      <MapPin className="h-3 w-3" /> Auf Karte öffnen
    </a>
  );
}
