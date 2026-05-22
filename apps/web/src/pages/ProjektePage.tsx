import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { objektApi, projektApi, userApi } from '../api/endpoints';
import type {
  ProjektCreate,
  ProjektRead,
  ProjektStatus,
} from '../api/types';

const STATUS_LABEL: Record<ProjektStatus, string> = {
  geplant: 'Geplant',
  laufend: 'Laufend',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert',
};

const STATUS_COLOR: Record<ProjektStatus, string> = {
  geplant: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  laufend: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  abgeschlossen: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  storniert: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const STATUS_ICON: Record<ProjektStatus, typeof Calendar> = {
  geplant: Calendar,
  laufend: Clock,
  abgeschlossen: CheckCircle2,
  storniert: XCircle,
};

const EMPTY_FORM: ProjektCreate = {
  name: '',
  beschreibung: '',
  objekt_id: null,
  verantwortlich_user_id: null,
  start_am: null,
  ende_am: null,
  status: 'geplant',
  notizen: '',
};

export function ProjektePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjektStatus[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjektCreate>(EMPTY_FORM);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['projekte', statusFilter],
    queryFn: () =>
      projektApi.list({
        status: statusFilter.length > 0 ? statusFilter : undefined,
      }),
  });

  const objekteQuery = useQuery({
    queryKey: ['objekte-for-projekt'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-projekt'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.beschreibung ?? '').toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  const create = useMutation({
    mutationFn: (payload: ProjektCreate) => projektApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjektCreate }) =>
      projektApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => projektApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projekte'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p: ProjektRead) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      beschreibung: p.beschreibung ?? '',
      objekt_id: p.objekt_id,
      verantwortlich_user_id: p.verantwortlich_user_id,
      start_am: p.start_am,
      ende_am: p.ende_am,
      status: p.status,
      notizen: p.notizen ?? '',
    });
    setShowModal(true);
  }

  function submit() {
    if (editingId) update.mutate({ id: editingId, payload: form });
    else create.mutate(form);
  }

  function toggleStatusFilter(s: ProjektStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <FolderKanban className="h-5 w-5 text-emerald-400" /> Projekte
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Bündel zusammengehöriger Tickets mit Verantwortlichem & Zeitraum
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neues Projekt
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(STATUS_LABEL) as ProjektStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatusFilter(s)}
              className={clsx(
                'rounded-md border px-2 py-1 text-xs',
                statusFilter.includes(s)
                  ? STATUS_COLOR[s]
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-zinc-500">
          {filtered.length} / {listQuery.data?.length ?? 0}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listQuery.isLoading && (
          <div className="col-span-full py-12 text-center text-sm text-zinc-500">
            Lade Projekte …
          </div>
        )}
        {!listQuery.isLoading && filtered.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 py-12 text-center">
            <FolderKanban className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <div className="text-sm text-zinc-400">Noch keine Projekte angelegt.</div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              <Plus className="h-3 w-3" /> Erstes Projekt anlegen
            </button>
          </div>
        )}
        {filtered.map((p) => {
          const Icon = STATUS_ICON[p.status];
          return (
            <div
              key={p.id}
              className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/tickets?projekt_id=${p.id}`}
                  className="min-w-0 flex-1 text-sm font-semibold text-zinc-100 hover:text-emerald-300"
                >
                  <div className="truncate">{p.name}</div>
                </Link>
                <span
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    STATUS_COLOR[p.status],
                  )}
                >
                  <Icon className="h-3 w-3" /> {STATUS_LABEL[p.status]}
                </span>
              </div>
              {p.beschreibung && (
                <p className="line-clamp-2 text-xs text-zinc-400">{p.beschreibung}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                <div className="flex items-center gap-1">
                  {p.verantwortlich && (
                    <span className="truncate">👤 {p.verantwortlich.full_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono">
                    {p.ticket_count} Ticket{p.ticket_count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              {(p.start_am || p.ende_am) && (
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Calendar className="h-3 w-3" />
                  {p.start_am ?? '?'} → {p.ende_am ?? '?'}
                </div>
              )}
              <div className="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Projekt "${p.name}" wirklich löschen?`)) remove.mutate(p.id);
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
              {editingId ? 'Projekt bearbeiten' : 'Neues Projekt'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-300">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                <div>
                  <label className="block text-sm text-zinc-300">Verantwortlich</label>
                  <select
                    value={form.verantwortlich_user_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, verantwortlich_user_id: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">— (keiner) —</option>
                    {usersQuery.data?.items.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-zinc-300">Start</label>
                  <input
                    type="date"
                    value={form.start_am ?? ''}
                    onChange={(e) => setForm({ ...form, start_am: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Ende</label>
                  <input
                    type="date"
                    value={form.ende_am ?? ''}
                    onChange={(e) => setForm({ ...form, ende_am: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-300">Status</label>
                  <select
                    value={form.status ?? 'geplant'}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as ProjektStatus })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    {(Object.keys(STATUS_LABEL) as ProjektStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Notizen</label>
                <textarea
                  rows={3}
                  value={form.notizen ?? ''}
                  onChange={(e) => setForm({ ...form, notizen: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!form.name.trim() || create.isPending || update.isPending}
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
