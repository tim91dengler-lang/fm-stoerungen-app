import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auswahllistenApi } from '../api/endpoints';
import type {
  AuswahllisteRead,
  AuswahllistenWertCreate,
  AuswahllistenWertRead,
} from '../api/types';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

export function AuswahllistenPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateListe, setShowCreateListe] = useState(false);
  const [newListeKey, setNewListeKey] = useState('');
  const [newListeLabel, setNewListeLabel] = useState('');
  const [deleteListeConfirm, setDeleteListeConfirm] =
    useState<AuswahllisteRead | null>(null);

  const qc = useQueryClient();
  const listenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });

  const createListe = useMutation({
    mutationFn: () =>
      auswahllistenApi.create({ key: newListeKey, label: newListeLabel }),
    onSuccess: (liste) => {
      qc.invalidateQueries({ queryKey: ['auswahllisten'] });
      setSelectedId(liste.id);
      setShowCreateListe(false);
      setNewListeKey('');
      setNewListeLabel('');
    },
  });

  const deleteListe = useMutation({
    mutationFn: (id: string) => auswahllistenApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auswahllisten'] });
      setSelectedId(null);
    },
  });

  const selected = listenQuery.data?.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Auswahllisten</h1>
          <p className="text-sm text-zinc-500">
            Konfigurierbare Status-, Prioritäts- und Kategorie-Werte je Mandant
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateListe(true)}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Neue Liste
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <aside className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Listen
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {listenQuery.data?.map((liste) => (
              <li
                key={liste.id}
                onClick={() => setSelectedId(liste.id)}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-zinc-900/50 ${selectedId === liste.id ? 'bg-emerald-500/10 font-medium text-emerald-300' : 'text-zinc-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span>{liste.label}</span>
                  {liste.ist_system && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                      System
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {liste.key} · {liste.werte.length} Werte
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 md:col-span-2">
          {selected ? (
            <ListeDetail
              liste={selected}
              onDelete={() => setDeleteListeConfirm(selected)}
            />
          ) : (
            <div className="p-8 text-center text-sm text-zinc-500">
              Liste links auswählen, um Werte zu bearbeiten.
            </div>
          )}
        </section>
      </div>

      {showCreateListe && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={() => setShowCreateListe(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-zinc-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Neue Auswahlliste</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Key (Slug, kebab/snake)
                </label>
                <input
                  type="text"
                  value={newListeKey}
                  onChange={(e) =>
                    setNewListeKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
                  }
                  placeholder="z.B. gewerk"
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Anzeige-Label
                </label>
                <input
                  type="text"
                  value={newListeLabel}
                  onChange={(e) => setNewListeLabel(e.target.value)}
                  placeholder="z.B. Gewerk"
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm bg-zinc-950 text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateListe(false)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm bg-zinc-950 text-zinc-100"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => createListe.mutate()}
                disabled={
                  !newListeKey || !newListeLabel || createListe.isPending
                }
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteListeConfirm !== null}
        title="Liste löschen?"
        message={
          deleteListeConfirm
            ? `Liste „${deleteListeConfirm.label}" wirklich löschen? Alle Werte werden ebenfalls entfernt.`
            : ''
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={deleteListe.isPending}
        onConfirm={() => {
          if (deleteListeConfirm) {
            deleteListe.mutate(deleteListeConfirm.id, {
              onSuccess: () => setDeleteListeConfirm(null),
            });
          }
        }}
        onCancel={() => setDeleteListeConfirm(null)}
      />
    </div>
  );
}

interface DetailProps {
  liste: AuswahllisteRead;
  onDelete: () => void;
}

function ListeDetail({ liste, onDelete }: DetailProps) {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newFarbe, setNewFarbe] = useState('slate');
  const [deleteWertConfirm, setDeleteWertConfirm] =
    useState<AuswahllistenWertRead | null>(null);

  const addWert = useMutation({
    mutationFn: (payload: AuswahllistenWertCreate) =>
      auswahllistenApi.addWert(liste.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auswahllisten'] });
      setNewKey('');
      setNewLabel('');
    },
  });

  const removeWert = useMutation({
    mutationFn: (wertId: string) => auswahllistenApi.removeWert(wertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auswahllisten'] }),
  });

  return (
    <div>
      <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{liste.label}</h2>
          <p className="text-xs text-zinc-500">
            Key: <span className="font-mono">{liste.key}</span>
            {liste.beschreibung ? ` · ${liste.beschreibung}` : ''}
          </p>
        </div>
        {!liste.ist_system && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-400 hover:underline"
          >
            Liste löschen
          </button>
        )}
      </div>

      <ul className="divide-y divide-zinc-800/60">
        {liste.werte.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between px-4 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              {w.farbe && (
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-${w.farbe}-500`}
                />
              )}
              <div>
                <div className="font-medium text-zinc-200">{w.label}</div>
                <div className="text-xs text-zinc-500">
                  {w.key} · Reihenfolge {w.reihenfolge}
                  {w.ist_system ? ' · System' : ''}
                </div>
              </div>
            </div>
            {!w.ist_system && (
              <button
                type="button"
                onClick={() => setDeleteWertConfirm(w)}
                className="text-xs text-red-400 hover:underline"
              >
                Löschen
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Neuen Wert hinzufügen
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newKey}
            placeholder="key"
            onChange={(e) =>
              setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
            }
            className="w-32 rounded-md border border-zinc-700 px-2 py-1 text-sm bg-zinc-950 text-zinc-100"
          />
          <input
            type="text"
            value={newLabel}
            placeholder="Anzeige-Label"
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 rounded-md border border-zinc-700 px-2 py-1 text-sm bg-zinc-950 text-zinc-100"
          />
          <select
            value={newFarbe}
            onChange={(e) => setNewFarbe(e.target.value)}
            className="rounded-md border border-zinc-700 px-2 py-1 text-sm bg-zinc-950 text-zinc-100"
          >
            {[
              'slate',
              'amber',
              'blue',
              'orange',
              'emerald',
              'red',
              'cyan',
              'yellow',
              'purple',
              'rose',
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              addWert.mutate({
                key: newKey,
                label: newLabel,
                reihenfolge: liste.werte.length,
                farbe: newFarbe,
              })
            }
            disabled={!newKey || !newLabel || addWert.isPending}
            className="rounded-md bg-emerald-500 px-3 py-1 text-sm text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            Hinzufügen
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteWertConfirm !== null}
        title="Wert löschen?"
        message={
          deleteWertConfirm
            ? `Wert „${deleteWertConfirm.label}" wirklich löschen?`
            : ''
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={removeWert.isPending}
        onConfirm={() => {
          if (deleteWertConfirm) {
            removeWert.mutate(deleteWertConfirm.id, {
              onSuccess: () => setDeleteWertConfirm(null),
            });
          }
        }}
        onCancel={() => setDeleteWertConfirm(null)}
      />
    </div>
  );
}
