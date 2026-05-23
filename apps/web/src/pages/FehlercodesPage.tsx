import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Plus } from 'lucide-react';
import {
  anlageApi,
  auswahllistenApi,
  fehlercodeApi,
  tickettypApi,
} from '../api/endpoints';
import type { FehlercodeCreate, FehlercodeRead } from '../api/types';

const EMPTY_FORM: FehlercodeCreate = {
  code: '',
  titel: '',
  beschreibung: '',
  loesung: '',
  kategorie_wert_id: null,
  prio_default_wert_id: null,
  tickettyp_default_id: null,
  anlage_id: null,
  quelle: '',
  aktiv: true,
};

export function FehlercodesPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FehlercodeCreate>(EMPTY_FORM);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['fehlercodes', search],
    queryFn: () => fehlercodeApi.list({ search: search || undefined }),
  });
  const anlagenQuery = useQuery({
    queryKey: ['anlagen-for-fehlercode'],
    queryFn: () => anlageApi.list({ aktiv_only: true }),
    staleTime: 60_000,
  });
  const tickettypenQuery = useQuery({
    queryKey: ['tickettypen'],
    queryFn: () => tickettypApi.list(),
    staleTime: 60_000,
  });
  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });
  const kategorienListe = auswahllistenQuery.data?.find((l) => l.key === 'ticket_kategorie');
  const prioListe = auswahllistenQuery.data?.find((l) => l.key === 'ticket_prioritaet');

  const create = useMutation({
    mutationFn: (payload: FehlercodeCreate) => fehlercodeApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fehlercodes'] });
      closeModal();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FehlercodeCreate }) =>
      fehlercodeApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fehlercodes'] });
      closeModal();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => fehlercodeApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fehlercodes'] }),
  });

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (f) =>
        f.code.toLowerCase().includes(q) ||
        f.titel.toLowerCase().includes(q) ||
        (f.beschreibung ?? '').toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(f: FehlercodeRead) {
    setEditingId(f.id);
    setForm({
      code: f.code,
      titel: f.titel,
      beschreibung: f.beschreibung ?? '',
      loesung: f.loesung ?? '',
      kategorie_wert_id: f.kategorie_wert_id,
      prio_default_wert_id: f.prio_default_wert_id,
      tickettyp_default_id: f.tickettyp_default_id,
      anlage_id: f.anlage_id,
      quelle: f.quelle ?? '',
      aktiv: f.aktiv,
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
            <AlertOctagon className="h-5 w-5 text-amber-400" /> Fehlercodes
          </h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.length} Fehlercodes` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neuer Fehlercode
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <input
          type="search"
          placeholder="Suche in Code, Titel, Beschreibung …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100"
        />
      </div>

      {listQuery.isLoading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lade Fehlercodes …
        </div>
      )}
      {!listQuery.isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Keine Fehlercodes gefunden.
        </div>
      )}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Titel</th>
                <th className="px-4 py-2 font-medium">Kategorie</th>
                <th className="px-4 py-2 font-medium">Anlage</th>
                <th className="px-4 py-2 font-medium">Verwendet</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                      {f.code}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-zinc-100">{f.titel}</div>
                    {f.beschreibung && (
                      <div className="text-xs text-zinc-500 line-clamp-1">{f.beschreibung}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">
                    {f.kategorie ? (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                        {f.kategorie.label}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">{f.anlage?.bezeichnung ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
                      {f.nutzung_count}×
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {f.aktiv ? (
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
                      onClick={() => openEdit(f)}
                      className="mr-2 text-xs font-medium text-emerald-300 hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (f.nutzung_count > 0) {
                          alert(
                            `Dieser Fehlercode wird von ${f.nutzung_count} Ticket${
                              f.nutzung_count === 1 ? '' : 's'
                            } referenziert. Bitte zuerst deaktivieren statt löschen.`,
                          );
                          return;
                        }
                        if (confirm(`Fehlercode "${f.code}" löschen?`)) remove.mutate(f.id);
                      }}
                      className="text-xs font-medium text-red-400 hover:underline"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
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
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
              {editingId ? 'Fehlercode bearbeiten' : 'Neuer Fehlercode'}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-zinc-300">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="z. B. RLT-2155"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-zinc-300">Titel *</label>
                  <input
                    type="text"
                    value={form.titel}
                    onChange={(e) => setForm({ ...form, titel: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Beschreibung</label>
                <textarea
                  rows={3}
                  value={form.beschreibung ?? ''}
                  onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                  placeholder="Wird bei Ticket-Auswahl als Beschreibung übernommen."
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Lösungshinweis (intern)</label>
                <textarea
                  rows={3}
                  value={form.loesung ?? ''}
                  onChange={(e) => setForm({ ...form, loesung: e.target.value })}
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
                  <label className="block text-sm text-zinc-300">Priorität (Default)</label>
                  <select
                    value={form.prio_default_wert_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, prio_default_wert_id: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">— (keine) —</option>
                    {prioListe?.werte.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Anlage</label>
                  <select
                    value={form.anlage_id ?? ''}
                    onChange={(e) => setForm({ ...form, anlage_id: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">— (keine) —</option>
                    {anlagenQuery.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bezeichnung}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Tickettyp (Default)</label>
                  <select
                    value={form.tickettyp_default_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, tickettyp_default_id: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">— (keiner) —</option>
                    {tickettypenQuery.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Quelle</label>
                  <input
                    type="text"
                    value={form.quelle ?? ''}
                    onChange={(e) => setForm({ ...form, quelle: e.target.value })}
                    placeholder="z. B. Schartec, EBO"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
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
                disabled={
                  !form.code.trim() ||
                  !form.titel.trim() ||
                  create.isPending ||
                  update.isPending
                }
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
