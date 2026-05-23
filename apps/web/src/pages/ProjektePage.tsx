import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type ColumnDef, type SortingState, type VisibilityState } from '@tanstack/react-table';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Pencil,
  Plus,
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
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'name', desc: false }],
  visibility: {},
  columnOrder: ['name', 'status', 'verantwortlich', 'zeitraum', 'ticket_count', '__actions__'],
};

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
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
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

  const columns = useMemo<ColumnDef<ProjektRead>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Projekt',
        cell: (ctx) => {
          const p = ctx.row.original;
          return (
            <div>
              <Link
                to={`/tickets?projekt_id=${p.id}`}
                className="font-medium text-zinc-100 hover:text-emerald-300"
              >
                {p.name}
              </Link>
              {p.beschreibung && (
                <div className="text-xs text-zinc-500 line-clamp-1">{p.beschreibung}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: (ctx) => {
          const s = ctx.row.original.status;
          const Icon = STATUS_ICON[s];
          return (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                STATUS_COLOR[s],
              )}
            >
              <Icon className="h-3 w-3" /> {STATUS_LABEL[s]}
            </span>
          );
        },
      },
      {
        id: 'verantwortlich',
        accessorFn: (row) => row.verantwortlich?.full_name ?? '',
        header: 'Verantwortlich',
        cell: (ctx) =>
          ctx.row.original.verantwortlich?.full_name ?? <span className="text-zinc-500">—</span>,
      },
      {
        id: 'zeitraum',
        accessorFn: (row) => `${row.start_am ?? ''} ${row.ende_am ?? ''}`,
        header: 'Zeitraum',
        cell: (ctx) => {
          const p = ctx.row.original;
          if (!p.start_am && !p.ende_am) return <span className="text-zinc-500">—</span>;
          return (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Calendar className="h-3 w-3" />
              {p.start_am ?? '?'} → {p.ende_am ?? '?'}
            </span>
          );
        },
      },
      {
        id: 'ticket_count',
        accessorKey: 'ticket_count',
        header: 'Tickets',
        cell: (ctx) => (
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
            {ctx.row.original.ticket_count}
          </span>
        ),
      },
      {
        id: '__actions__',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        cell: (ctx) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => openEdit(ctx.row.original)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Bearbeiten"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Projekt "${ctx.row.original.name}" wirklich löschen?`))
                  remove.mutate(ctx.row.original.id);
              }}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
              title="Löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

      <PowerListenView<ProjektRead>
        viewKey="projekte"
        columns={columns}
        data={filtered}
        search={search}
        onSearchChange={setSearch}
        visibility={config.visibility}
        onVisibilityChange={(v) => setConfig((p) => ({ ...p, visibility: v }))}
        sorting={config.sorting}
        onSortingChange={(s) => setConfig((p) => ({ ...p, sorting: s }))}
        columnFilters={[]}
        onColumnFiltersChange={() => {}}
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
        filterRenderers={{
          name: TextFilter,
          verantwortlich: TextFilter,
          status: (props) => (
            <SelectFilter
              {...props}
              options={(Object.keys(STATUS_LABEL) as ProjektStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />
          ),
        }}
        count={{
          filtered: filtered.length,
          total: listQuery.data?.length ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="projekte"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Projekten …"
        showFooter
        itemLabel={{ singular: 'Projekt', plural: 'Projekte' }}
      />

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
