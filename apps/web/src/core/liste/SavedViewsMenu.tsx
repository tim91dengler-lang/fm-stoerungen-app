import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ansichtenApi } from '../../api/endpoints';
import type { GespeicherteAnsichtRead } from '../../api/types';

interface Props {
  viewKey: string;
  currentConfig: Record<string, unknown>;
  onApply: (config: Record<string, unknown>) => void;
  /** Aktuell aktive Ansicht-ID, optional. */
  activeId?: string | null;
}

export function SavedViewsMenu({
  viewKey,
  currentConfig,
  onApply,
  activeId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  const listQuery = useQuery({
    queryKey: ['ansichten', viewKey],
    queryFn: () => ansichtenApi.list(viewKey),
    staleTime: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      ansichtenApi.create({
        view_key: viewKey,
        name: newName,
        config: currentConfig,
        ist_default: makeDefault,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ansichten', viewKey] });
      setShowSaveDialog(false);
      setNewName('');
      setMakeDefault(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => ansichtenApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ansichten', viewKey] }),
  });

  const views = listQuery.data ?? [];
  const active = views.find((v) => v.id === activeId);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900/50"
        >
          📌 {active ? active.name : 'Ansicht'}
        </button>
        {open && (
          <div className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-lg">
            {views.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">
                Noch keine gespeicherten Ansichten.
              </div>
            ) : (
              views.map((v) => (
                <ViewRow
                  key={v.id}
                  view={v}
                  active={v.id === activeId}
                  onApply={() => {
                    onApply(v.config);
                    setOpen(false);
                  }}
                  onDelete={() => deleteMut.mutate(v.id)}
                />
              ))
            )}
            <div className="my-1 border-t border-zinc-800" />
            <button
              type="button"
              onClick={() => {
                setShowSaveDialog(true);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-emerald-300 hover:bg-emerald-500/10"
            >
              + Aktuelle Ansicht speichern
            </button>
          </div>
        )}
      </div>

      {showSaveDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-zinc-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold">Ansicht speichern</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Offene Heizungs-Tickets"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                />
                Als Standard für diese Liste setzen
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={!newName || saveMut.isPending}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ViewRow({
  view,
  active,
  onApply,
  onDelete,
}: {
  view: GespeicherteAnsichtRead;
  active: boolean;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-zinc-900/50 ${
        active ? 'bg-emerald-500/10' : ''
      }`}
    >
      <button
        type="button"
        onClick={onApply}
        className="flex-1 truncate text-left"
        title={view.name}
      >
        {view.name}
        {view.ist_default && (
          <span className="ml-2 text-[10px] uppercase text-emerald-700">
            default
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Ansicht "${view.name}" löschen?`)) onDelete();
        }}
        className="ml-2 text-xs text-red-600 hover:underline"
        title="Löschen"
      >
        ✕
      </button>
    </div>
  );
}
