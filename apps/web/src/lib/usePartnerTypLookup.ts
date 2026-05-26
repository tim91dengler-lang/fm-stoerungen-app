import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { auswahllistenApi } from '../api/endpoints';
import type {
  AuswahllistenWertRead,
  PartnerTypSlug,
  UUID,
} from '../api/types';

/**
 * Lookup-Hilfen für die `partner_typ`-Auswahlliste.
 *
 * Track 3 / Migration 0016: `GeschaeftsPartner.typen` ist seit dem Refactor
 * ein UUID-Array auf Auswahllisten-Werte (statt ein Enum-Slug-Array).
 * Für die Anzeige (Badges, Filter-Chips, Multi-Select) brauchen wir den
 * Auflösungs-Weg in beide Richtungen — diesen Hook gibt es deshalb.
 */
export interface PartnerTypLookup {
  /** Alle Werte der Liste in Reihenfolge. Leeres Array, solange noch lädt. */
  werte: AuswahllistenWertRead[];
  /** Label für eine UUID. Fallback: leerer String, wenn unbekannt. */
  labelFor(id: UUID | null | undefined): string;
  /** Farbe-Slug (z. B. 'blue', 'amber') für eine UUID. Fallback: null. */
  colorFor(id: UUID | null | undefined): string | null;
  /** Slug (`mieter`, `eigentuemer`, …) für eine UUID. Fallback: null. */
  slugFor(id: UUID | null | undefined): PartnerTypSlug | null;
  /** UUID für einen Slug. Fallback: null, wenn der Slug nicht in der Liste ist. */
  idForSlug(slug: PartnerTypSlug): UUID | null;
  isLoading: boolean;
  isError: boolean;
}

export function usePartnerTypLookup(): PartnerTypLookup {
  const q = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  return useMemo<PartnerTypLookup>(() => {
    const liste = (q.data ?? []).find((l) => l.key === 'partner_typ');
    const werte = liste?.werte ?? [];
    const byId = new Map<UUID, AuswahllistenWertRead>(werte.map((w) => [w.id, w]));
    const byKey = new Map<string, AuswahllistenWertRead>(werte.map((w) => [w.key, w]));

    return {
      werte,
      labelFor: (id) => (id ? byId.get(id)?.label ?? '' : ''),
      colorFor: (id) => (id ? byId.get(id)?.farbe ?? null : null),
      slugFor: (id) => (id ? (byId.get(id)?.key as PartnerTypSlug) ?? null : null),
      idForSlug: (slug) => byKey.get(slug)?.id ?? null,
      isLoading: q.isLoading,
      isError: q.isError,
    };
  }, [q.data, q.isLoading, q.isError]);
}
