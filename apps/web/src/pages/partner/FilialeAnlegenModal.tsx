import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type { UUID } from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';
import { TypenMultiSelect } from './TypenMultiSelect';
import { extractMutationError } from './helpers';

interface Props {
  parentPartnerId: UUID;
  parentName: string;
  /** Defaults für `typen` (Filiale erbt typisch die Mutter-Typen). */
  parentTypen: UUID[];
  partnerTypLookup: PartnerTypLookup;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none';

/**
 * Modal: neue Filiale unter einem bestehenden Partner anlegen
 * (Track 3 Polish 2 — Tim 2026-05-27).
 *
 * Aus alter `PartnerDetailPage.FilialeAnlegenModal` extrahiert + auf den
 * neuen `TypenMultiSelect` (Combobox) umgestellt. Nach Anlage navigiert
 * direkt zur neuen Filiale.
 */
export function FilialeAnlegenModal({
  parentPartnerId,
  parentName,
  parentTypen,
  partnerTypLookup,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [typen, setTypen] = useState<UUID[]>(parentTypen);

  const createMut = useMutation({
    mutationFn: () =>
      partnerApi.create({
        name: name.trim(),
        parent_partner_id: parentPartnerId,
        typen,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['partner', parentPartnerId] });
      qc.invalidateQueries({ queryKey: ['partner', parentPartnerId, 'hierarchie'] });
      onClose();
      navigate(`/stammdaten/partner/${created.id}`);
    },
  });

  const submitError = extractMutationError(createMut.error);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Filiale anlegen</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <p className="text-xs text-zinc-400">
            Neue Filiale unter <span className="text-zinc-200">{parentName}</span>.
            Adresse, Kontakte und weitere Stammdaten kannst du nach dem Anlegen
            auf der Filial-Detailseite pflegen.
          </p>

          <div>
            <div className="mb-1 text-[11px] font-medium text-zinc-400">Name *</div>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Niederlassung Frankfurt"
              className={inputCls}
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium text-zinc-400">
              Typen (Vorschlag aus Mutter — anpassbar)
            </div>
            <TypenMultiSelect
              value={typen}
              onChange={setTypen}
              lookup={partnerTypLookup}
              size="md"
            />
          </div>

          {submitError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              <div className="font-semibold">Anlegen fehlgeschlagen:</div>
              <div className="mt-0.5">{submitError}</div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-800 bg-zinc-900 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {createMut.isPending ? 'Lege an …' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
