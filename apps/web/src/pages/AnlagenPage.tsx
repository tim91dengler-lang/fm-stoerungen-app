import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Droplets,
  Plus,
  Thermometer,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { anlageApi, auswahllistenApi, objektApi } from '../api/endpoints';
import type { AnlageCreate, AnlageRead } from '../api/types';

const ICON_MAP: Record<string, typeof Activity> = {
  Wind,
  Wrench,
  Thermometer,
  Zap,
  Droplets,
  Activity,
};

function iconFor(name: string | null | undefined) {
  if (name && name in ICON_MAP) return ICON_MAP[name] ?? Activity;
  return Activity;
}

const EMPTY_FORM: AnlageCreate = {
  bezeichnung: '',
  beschreibung: '',
  icon_name: 'Activity',
  kategorie_wert_id: null,
  objekt_id: null,
  stockwerk_id: null,
  aktiv: true,
  reihenfolge: 0,
};

export function AnlagenPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnlageCreate>(EMPTY_FORM);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['anlagen', search],
    queryFn: () => anlageApi.list({ search: search || undefined }),
  });

  const objekteQuery = useQuery({
    queryKey: ['objekte-for-anlage'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const kategorienListe = auswahllistenQuery.data?.find((l) => l.key === 'ticket_kategorie');

  const create = useMutation({
    mutationFn: (payload: AnlageCreate) => anlageApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anlagen'] });
      closeModal();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AnlageCreate }) =>
      anlageApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anlagen'] });
      closeModal();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => anlageApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anlagen'] }),
  });

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (a) =>
        a.bezeichnung.toLowerCase().includes(q) ||
        (a.beschreibung ?? '').toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(a: AnlageRead) {
    setEditingId(a.id);
    setForm({
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung ?? '',
      icon_name: a.icon_name ?? 'Activity',
      kategorie_wert_id: a.kategorie_wert_id,
      objekt_id: a.objekt_id,
      stockwerk_id: a.stockwerk_id,
      aktiv: a.aktiv,
      reihenfolge: a.reihenfolge,
    });
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }
  function submit() {
    if (editingId) update.mutate({ id: editingId, payload: form });
    else create.mutate(form);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Activity className="h-5 w-5 text-emerald-400" /> Anlagen
          </h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.length} Anlagen` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neue Anlage
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <input
          type="search"
          placeholder="Suche in Bezeichnung, Beschreibung …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100"
        />
      </div>

      {listQuery.isLoading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lade Anlagen …
        </div>
      )}
      {!listQuery.isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Keine Anlagen gefunden.
        </div>
      )}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Anlage</th>
                <th className="px-4 py-2 font-medium">Kategorie</th>
                <th className="px-4 py-2 font-medium">Objekt</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((a) => {
                const Icon = iconFor(a.icon_name);
                return (
                  <tr key={a.id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-emerald-300" />
                        <div>
                          <div className="font-medium text-zinc-100">{a.bezeichnung}</div>
                          {a.beschreibung && (
                            <div className="text-xs text-zinc-500">{a.beschreibung}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">
                      {a.kategorie ? (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                          {a.kategorie.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{a.objekt?.name ?? '—'}</td>
                    <td className="px-4 py-2">
                      {a.aktiv ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                          aktiv
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          inaktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="mr-2 text-xs font-medium text-emerald-300 hover:underline"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Anlage "${a.bezeichnung}" löschen?`)) remove.mutate(a.id);
                        }}
                        className="text-xs font-medium text-red-400 hover:underline"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
              {editingId ? 'Anlage bearbeiten' : 'Neue Anlage'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-300">Bezeichnung *</label>
                <input
                  type="text"
                  value={form.bezeichnung}
                  onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
                  placeholder="z. B. RLT-03 oder Heizkreis Süd"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Beschreibung</label>
                <textarea
                  rows={2}
                  value={form.beschreibung ?? ''}
                  onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-300">Kategorie</label>
                  <select
                    value={form.kategorie_wert_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, kategorie_wert_id: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">— (keine) —</option>
                    {kategorienListe?.werte.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Icon</label>
                  <select
                    value={form.icon_name ?? 'Activity'}
                    onChange={(e) => setForm({ ...form, icon_name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    {Object.keys(ICON_MAP).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Objekt</label>
                <select
                  value={form.objekt_id ?? ''}
                  onChange={(e) => setForm({ ...form, objekt_id: e.target.value || null })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">— (keins) —</option>
                  {objekteQuery.data?.items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="aktiv"
                  type="checkbox"
                  checked={form.aktiv ?? true}
                  onChange={(e) => setForm({ ...form, aktiv: e.target.checked })}
                  className="accent-emerald-500"
                />
                <label htmlFor="aktiv" className="text-sm text-zinc-300">
                  Aktiv
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!form.bezeichnung.trim() || create.isPending || update.isPending}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {editingId ? 'Speichern' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
