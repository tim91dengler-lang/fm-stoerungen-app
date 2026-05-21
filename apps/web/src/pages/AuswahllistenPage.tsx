import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auswahllistenApi } from '../api/endpoints';
import type { AuswahllisteRead, AuswahllistenWertCreate } from '../api/types';

export function AuswahllistenPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateListe, setShowCreateListe] = useState(false);
  const [newListeKey, setNewListeKey] = useState('');
  const [newListeLabel, setNewListeLabel] = useState('');

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
          <h1 className="text-2xl font-semibold text-slate-900">Auswahllisten</h1>
          <p className="text-sm text-slate-500">
            Konfigurierbare Status-, Prioritäts- und Kategorie-Werte je Mandant
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateListe(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Neue Liste
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Listen
          </div>
          <ul className="divide-y divide-slate-100">
            {listenQuery.data?.map((liste) => (
              <li
                key={liste.id}
                onClick={() => setSelectedId(liste.id)}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-slate-50 ${selectedId === liste.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>{liste.label}</span>
                  {liste.ist_system && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                      System
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {liste.key} · {liste.werte.length} Werte
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white md:col-span-2">
          {selected ? (
            <ListeDetail
              liste={selected}
              onDelete={() => {
                if (
                  confirm(
                    `Liste "${selected.label}" wirklich löschen? (Werte werden ebenfalls entfernt.)`,
                  )
                ) {
                  deleteListe.mutate(selected.id);
                }
              }}
            />
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              Liste links auswählen, um Werte zu bearbeiten.
            </div>
          )}
        </section>
      </div>

      {showCreateListe && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowCreateListe(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Neue Auswahlliste</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Key (Slug, kebab/snake)
                </label>
                <input
                  type="text"
                  value={newListeKey}
                  onChange={(e) =>
                    setNewListeKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
                  }
                  placeholder="z.B. gewerk"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Anzeige-Label
                </label>
                <input
                  type="text"
                  value={newListeLabel}
                  onChange={(e) => setNewListeLabel(e.target.value)}
                  placeholder="z.B. Gewerk"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateListe(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => createListe.mutate()}
                disabled={
                  !newListeKey || !newListeLabel || createListe.isPending
                }
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:bg-slate-400"
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{liste.label}</h2>
          <p className="text-xs text-slate-500">
            Key: <span className="font-mono">{liste.key}</span>
            {liste.beschreibung ? ` · ${liste.beschreibung}` : ''}
          </p>
        </div>
        {!liste.ist_system && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-700 hover:underline"
          >
            Liste löschen
          </button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
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
                <div className="font-medium text-slate-800">{w.label}</div>
                <div className="text-xs text-slate-500">
                  {w.key} · Reihenfolge {w.reihenfolge}
                  {w.ist_system ? ' · System' : ''}
                </div>
              </div>
            </div>
            {!w.ist_system && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Wert "${w.label}" löschen?`)) {
                    removeWert.mutate(w.id);
                  }
                }}
                className="text-xs text-red-700 hover:underline"
              >
                Löschen
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newLabel}
            placeholder="Anzeige-Label"
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <select
            value={newFarbe}
            onChange={(e) => setNewFarbe(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
            className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:bg-slate-400"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
