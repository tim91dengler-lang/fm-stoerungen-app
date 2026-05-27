import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';

import { partnerApi } from '../../api/endpoints';
import type {
  AuswahllisteRead,
  PartnerAdresseRead,
  PartnerRead,
} from '../../api/types';
import { ConfirmDialog } from '../../core/liste/ConfirmDialog';
import { PartnerAdresseModal } from './PartnerAdresseModal';

interface Props {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
}

/**
 * Adress-Block für Tab 1 / Allgemein (Track 3 Polish 2026-05-26).
 *
 * - Hauptsitz prominent: erste Adresse mit `ist_primaer=true`,
 *   sonst die erste verknüpfte Adresse.
 * - Aktions-Buttons am Hauptsitz: ✎ Bearbeiten, 🗑 Lösen.
 * - „+ Adresse"-Button im Header öffnet das Verknüpfen-Modal.
 * - Weitere Adressen (Rechnungs-, Liefer-, Baustellen-Adressen) als
 *   kompakte Liste darunter, jeweils mit ⭐ Als Hauptsitz / ✎ / 🗑.
 */
export function HauptsitzBlock({ partner, listen }: Props) {
  const qc = useQueryClient();
  const adresstypen = listen.get('adresstyp')?.werte ?? [];
  const typLabel = new Map(adresstypen.map((t) => [t.id, t.label]));

  const [modalState, setModalState] = useState<
    | { mode: 'create'; defaultPrimaer: boolean }
    | { mode: 'edit'; link: PartnerAdresseRead }
    | null
  >(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PartnerAdresseRead | null>(null);

  const links = partner.adress_links;
  const hauptsitz = links.find((a) => a.ist_primaer) ?? links[0] ?? null;
  const weitere = links.filter((a) => a.id !== hauptsitz?.id);

  const deleteMut = useMutation({
    mutationFn: (linkId: string) => partnerApi.removeAdresse(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partner.id] });
      setDeleteConfirm(null);
    },
  });

  const setPrimaerMut = useMutation({
    mutationFn: (linkId: string) =>
      partnerApi.updateAdresse(linkId, { ist_primaer: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });

  function adresseEinzeilig(link: PartnerAdresseRead): string {
    const a = link.adresse;
    if (!a) return '—';
    const head = `${a.strasse}${a.hausnummer ? ' ' + a.hausnummer : ''}`.trim();
    const tail = `${a.plz} ${a.ort}`.trim();
    return [head, tail].filter(Boolean).join(', ');
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Hauptsitz &amp; Adressen
        </h2>
        <button
          type="button"
          onClick={() =>
            setModalState({ mode: 'create', defaultPrimaer: !hauptsitz })
          }
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> Adresse
        </button>
      </div>

      {hauptsitz ? (
        <div className="space-y-3">
          <div className="group flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <Star className="mt-0.5 h-4 w-4 shrink-0 fill-emerald-400 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wide text-emerald-400">
                Hauptsitz
              </div>
              <div className="text-sm text-zinc-100">
                {adresseEinzeilig(hauptsitz)}
              </div>
              {hauptsitz.adresse?.land && hauptsitz.adresse.land !== 'DE' && (
                <div className="text-xs text-zinc-400">
                  {hauptsitz.adresse.land}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <IconBtn
                title="Bearbeiten"
                onClick={() => setModalState({ mode: 'edit', link: hauptsitz })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title="Lösen"
                tone="danger"
                onClick={() => setDeleteConfirm(hauptsitz)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>

          {weitere.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                Weitere Adressen ({weitere.length})
              </div>
              <ul className="space-y-1">
                {weitere.map((link) => (
                  <li
                    key={link.id}
                    className="group flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-950/30 p-2"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      {link.typ_id && (
                        <span className="mr-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          {typLabel.get(link.typ_id) ?? '?'}
                        </span>
                      )}
                      <span className="text-xs text-zinc-200">
                        {adresseEinzeilig(link)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <IconBtn
                        title="Als Hauptsitz markieren"
                        onClick={() => setPrimaerMut.mutate(link.id)}
                      >
                        <Star className="h-3 w-3" />
                      </IconBtn>
                      <IconBtn
                        title="Bearbeiten"
                        onClick={() => setModalState({ mode: 'edit', link })}
                      >
                        <Pencil className="h-3 w-3" />
                      </IconBtn>
                      <IconBtn
                        title="Lösen"
                        tone="danger"
                        onClick={() => setDeleteConfirm(link)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </IconBtn>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-zinc-700 px-3 py-4 text-center text-xs text-zinc-500">
          Keine Adresse verknüpft. Klick auf &bdquo;+ Adresse&ldquo; oben rechts.
        </div>
      )}

      {modalState && (
        <PartnerAdresseModal
          partnerId={partner.id}
          listen={listen}
          initial={modalState.mode === 'edit' ? modalState.link : null}
          defaultPrimaer={
            modalState.mode === 'create' ? modalState.defaultPrimaer : false
          }
          onClose={() => setModalState(null)}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Adress-Verknüpfung lösen?"
        message={
          deleteConfirm
            ? `Die Verknüpfung "${adresseEinzeilig(deleteConfirm)}" wird gelöst. Die Adresse selbst bleibt im System erhalten.`
            : ''
        }
        confirmLabel="Lösen"
        tone="danger"
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </section>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        'rounded-md p-1 transition-colors',
        tone === 'danger'
          ? 'text-zinc-400 hover:bg-red-500/15 hover:text-red-300'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
      )}
    >
      {children}
    </button>
  );
}
