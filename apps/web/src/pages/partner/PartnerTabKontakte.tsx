import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type {
  AuswahllisteRead,
  PartnerKontaktRead,
  PartnerRead,
} from '../../api/types';
import { ConfirmDialog } from '../../core/liste/ConfirmDialog';
import { KontaktModal } from './KontaktModal';

interface Props {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
}

/**
 * Tab 2 — Kontakte (Spec §5.1 / Mockup Kontakte-Tabelle).
 *
 * 7 Spalten: Anrede · Vorname · Nachname · Rolle · Telefon · Mobil · E-Mail
 * plus ⋯-Menü pro Zeile (Bearbeiten, Hauptkontakt setzen, Löschen).
 */
export function PartnerTabKontakte({ partner, listen }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PartnerKontaktRead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PartnerKontaktRead | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const anrede = useMemo(() => {
    const werte = listen.get('anrede')?.werte ?? [];
    return new Map(werte.map((a) => [a.id, a.label]));
  }, [listen]);
  const rolleLabel = useMemo(() => {
    const werte = listen.get('kontakt_rolle')?.werte ?? [];
    return new Map(werte.map((r) => [r.id, r.label]));
  }, [listen]);

  const filtered = useMemo(() => {
    if (!search) return partner.kontakte;
    const needle = search.toLowerCase();
    return partner.kontakte.filter((k) => {
      const fields = [
        k.vorname,
        k.nachname,
        k.email,
        k.telefon,
        k.mobil,
        k.titel,
        ...k.rollen.map((r) => rolleLabel.get(r) ?? ''),
      ];
      return fields.some((v) => v && v.toString().toLowerCase().includes(needle));
    });
  }, [search, partner.kontakte, rolleLabel]);

  const setHauptmut = useMutation({
    mutationFn: (k: PartnerKontaktRead) =>
      partnerApi.updateKontakt(k.id, { ist_hauptkontakt: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => partnerApi.removeKontakt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partner.id] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Suche in Kontakten …"
          className="w-72 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Kontakt anlegen
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-400">
            <tr>
              <Th>Anrede</Th>
              <Th>Vorname</Th>
              <Th>Nachname</Th>
              <Th>Rolle</Th>
              <Th>Telefon</Th>
              <Th>Mobil</Th>
              <Th>E-Mail</Th>
              <Th className="w-8"></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-xs text-zinc-500"
                >
                  Keine Kontakte vorhanden.
                </td>
              </tr>
            ) : (
              filtered.map((k) => (
                <tr
                  key={k.id}
                  className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                >
                  <Td>{(k.anrede_id && anrede.get(k.anrede_id)) || '—'}</Td>
                  <Td>
                    <span className="text-zinc-200">{k.vorname ?? '—'}</span>
                    {k.ist_hauptkontakt && (
                      <Star
                        className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400"
                        aria-label="Hauptkontakt"
                      />
                    )}
                  </Td>
                  <Td>{k.nachname ?? '—'}</Td>
                  <Td>
                    {k.rollen.length === 0
                      ? '—'
                      : k.rollen
                          .map((r) => rolleLabel.get(r) ?? '?')
                          .filter(Boolean)
                          .join(', ')}
                  </Td>
                  <Td>{k.telefon ?? '—'}</Td>
                  <Td>{k.mobil ?? '—'}</Td>
                  <Td>{k.email ?? '—'}</Td>
                  <Td className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(openMenuId === k.id ? null : k.id)
                      }
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      aria-label="Aktionen"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuId === k.id && (
                      <div
                        className="absolute right-2 z-10 mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
                        onMouseLeave={() => setOpenMenuId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setEditing(k);
                            setShowModal(true);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Bearbeiten
                        </button>
                        {!k.ist_hauptkontakt && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setHauptmut.mutate(k);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                          >
                            Als Hauptkontakt setzen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteConfirm(k);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/15"
                        >
                          <Trash2 className="mr-1 inline h-3 w-3" />
                          Löschen
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <KontaktModal
          partnerId={partner.id}
          listen={listen}
          initial={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Kontakt löschen?"
        message={
          deleteConfirm
            ? `Kontakt "${deleteConfirm.vorname ?? ''} ${deleteConfirm.nachname ?? ''}" wird unwiderruflich gelöscht.`
            : ''
        }
        confirmLabel="Löschen"
        tone="danger"
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-zinc-300 ${className ?? ''}`}>{children}</td>;
}
