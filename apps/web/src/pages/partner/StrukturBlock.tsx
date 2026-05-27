import { useState } from 'react';
import { Plus } from 'lucide-react';

import type {
  PartnerHierarchieResponse,
  PartnerRead,
} from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';
import { FilialeAnlegenModal } from './FilialeAnlegenModal';
import { FilialenBaum } from './FilialenBaum';

interface Props {
  partner: PartnerRead;
  partnerTypLookup: PartnerTypLookup;
  hierarchie: PartnerHierarchieResponse | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Rechte Spalte in Tab 'Allgemein': Filialen-Baum + „+ Filiale"-Button
 * (Track 3 Polish 2 — Tim 2026-05-27).
 *
 * Der Button öffnet das `FilialeAnlegenModal` mit dem aktuellen Partner
 * als Mutter. Nach erfolgreichem Anlegen invalidiert das Modal die
 * Hierarchie und navigiert zur neuen Filiale.
 */
export function StrukturBlock({
  partner,
  partnerTypLookup,
  hierarchie,
  isLoading,
  isError,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Struktur
        </h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> Filiale
        </button>
      </div>

      {isLoading && (
        <div className="text-xs text-zinc-500">Lade Filialen-Baum …</div>
      )}
      {isError && (
        <div className="text-xs text-red-400">
          Konnte Filialen-Baum nicht laden.
        </div>
      )}
      {hierarchie && <FilialenBaum root={hierarchie.root} />}

      {showModal && (
        <FilialeAnlegenModal
          parentPartnerId={partner.id}
          parentName={partner.name}
          parentTypen={partner.typen}
          partnerTypLookup={partnerTypLookup}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}
