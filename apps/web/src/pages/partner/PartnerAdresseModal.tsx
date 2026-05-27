import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type {
  AdresseRead,
  AuswahllisteRead,
  PartnerAdresseRead,
} from '../../api/types';
import { AdresseSearchSelect } from '../../components/AdresseSearchSelect';
import { extractMutationError } from './helpers';

interface Props {
  partnerId: string;
  listen: Map<string, AuswahllisteRead>;
  /** Wenn gesetzt: bearbeiten statt neu verknüpfen. */
  initial: PartnerAdresseRead | null;
  /** Wenn `true` und kein `initial`: neue Adresse wird gleich als primär markiert. */
  defaultPrimaer?: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none';

/**
 * Modal: Adresse mit Partner verknüpfen / Verknüpfung bearbeiten.
 *
 * Track 3 Polish (2026-05-26): Adress-Pflege im Allgemein-Tab über
 * `HauptsitzBlock` — Tim hatte Sub-PR B nur read-only.
 */
export function PartnerAdresseModal({
  partnerId,
  listen,
  initial,
  defaultPrimaer = false,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const adresstypen = listen.get('adresstyp')?.werte ?? [];
  const [adresse, setAdresse] = useState<AdresseRead | null>(
    initial?.adresse ?? null,
  );
  const [typId, setTypId] = useState<string>(initial?.typ_id ?? '');
  const [istPrimaer, setIstPrimaer] = useState(
    initial?.ist_primaer ?? defaultPrimaer,
  );

  const createMut = useMutation({
    mutationFn: () =>
      partnerApi.createAdresse(partnerId, {
        adresse_id: adresse!.id,
        typ_id: typId || null,
        ist_primaer: istPrimaer,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: () =>
      partnerApi.updateAdresse(initial!.id, {
        typ_id: typId || null,
        ist_primaer: istPrimaer,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      onClose();
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const submitError = extractMutationError(createMut.error ?? updateMut.error);

  function handleSubmit() {
    if (initial) updateMut.mutate();
    else createMut.mutate();
  }

  const isEditing = initial !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isEditing ? 'Adress-Verknüpfung bearbeiten' : 'Adresse verknüpfen'}
          </h2>
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
          {isEditing ? (
            // Im Edit-Modus die Adresse selbst nicht tauschbar (nur typ+primär)
            <div>
              <div className="mb-1 text-[11px] font-medium text-zinc-400">Adresse</div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-200">
                {adresse
                  ? `${adresse.strasse}${adresse.hausnummer ? ' ' + adresse.hausnummer : ''}, ${adresse.plz} ${adresse.ort}`
                  : '—'}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[11px] font-medium text-zinc-400">
                Adresse suchen oder anlegen
              </div>
              <AdresseSearchSelect selected={adresse} onChange={setAdresse} />
            </div>
          )}

          <div>
            <div className="mb-1 text-[11px] font-medium text-zinc-400">
              Adress-Typ
            </div>
            <select
              value={typId}
              onChange={(e) => setTypId(e.target.value)}
              className={inputCls}
            >
              <option value="">— keiner —</option>
              {adresstypen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={istPrimaer}
              onChange={(e) => setIstPrimaer(e.target.checked)}
              className="accent-emerald-500"
            />
            Als Hauptsitz markieren
          </label>

          {submitError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              <div className="font-semibold">Speichern fehlgeschlagen:</div>
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
            onClick={handleSubmit}
            disabled={isPending || (!isEditing && !adresse)}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {isPending ? 'Speichere …' : isEditing ? 'Speichern' : 'Verknüpfen'}
          </button>
        </div>
      </div>
    </div>
  );
}
