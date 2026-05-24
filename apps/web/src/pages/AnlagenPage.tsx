import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Activity,
  Droplets,
  Pencil,
  Plus,
  Thermometer,
  Trash2,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { anlageApi, auswahllistenApi, objektApi } from '../api/endpoints';
import type { AnlageCreate, AnlageRead } from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

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

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'bezeichnung', desc: false }],
  visibility: {},
  columnOrder: [
    'bezeichnung',
    'kategorie',
    'objekt',
    'aktiv',
    'beschreibung',
    '__actions__',
  ],
  columnFilters: [],
  grouping: [],
};

export function AnlagenPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnlageCreate>(EMPTY_FORM);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<AnlageRead[] | null>(null);
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

  const kategorienListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'ticket_kategorie',
  );

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

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => anlageApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anlagen'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

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

  // Backend returns Array (not PaginatedResponse) for /anlagen.
  // Global search is client-side; backend search param is also passed
  // for server-side narrowing — both work together.
  const data = listQuery.data ?? [];

  const columns = useMemo<ColumnDef<AnlageRead>[]>(
    () => [
      {
        id: 'bezeichnung',
        accessorKey: 'bezeichnung',
        header: 'Bezeichnung',
        filterFn: 'includesString',
        cell: (ctx) => {
          const a = ctx.row.original;
          const Icon = iconFor(a.icon_name);
          return (
            <button
              type="button"
              onClick={() => openEdit(a)}
              className="flex items-center gap-2 text-left"
            >
              <Icon className="h-4 w-4 shrink-0 text-emerald-300" />
              <span className="font-medium text-zinc-100 hover:text-emerald-300">
                {a.bezeichnung}
              </span>
            </button>
          );
        },
      },
      {
        id: 'kategorie',
        accessorFn: (row) => row.kategorie?.label ?? '',
        header: 'Kategorie',
        filterFn: 'includesString',
        cell: (ctx) => {
          const k = ctx.row.original.kategorie;
          if (!k) return <span className="text-zinc-500">—</span>;
          return (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {k.label}
            </span>
          );
        },
      },
      {
        id: 'objekt',
        accessorFn: (row) => row.objekt?.name ?? '',
        header: 'Objekt',
        filterFn: 'includesString',
        cell: (ctx) =>
          ctx.row.original.objekt?.name ?? (
            <span className="text-zinc-500">—</span>
          ),
      },
      {
        id: 'aktiv',
        accessorFn: (row) => (row.aktiv ? 'aktiv' : 'inaktiv'),
        header: 'Status',
        filterFn: 'arrIncludesSome',
        cell: (ctx) =>
          ctx.row.original.aktiv ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              aktiv
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              inaktiv
            </span>
          ),
      },
      {
        id: 'beschreibung',
        accessorKey: 'beschreibung',
        header: 'Beschreibung',
        filterFn: 'includesString',
        cell: (ctx) => {
          const b = ctx.row.original.beschreibung;
          if (!b) return <span className="text-zinc-500">—</span>;
          return (
            <span className="line-clamp-1 text-xs text-zinc-400">{b}</span>
          );
        },
      },
      {
        id: '__actions__',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        enableGrouping: false,
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
              onClick={() => setBulkConfirm([ctx.row.original])}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
              title="Löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  function confirmBulkDelete() {
    if (!bulkConfirm) return;
    if (bulkConfirm.length === 1 && bulkConfirm[0] !== undefined) {
      remove.mutate(bulkConfirm[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(bulkConfirm.map((a) => a.id));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
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

      <PowerListenView<AnlageRead>
        viewKey="anlagen"
        columns={columns}
        data={data}
        search={search}
        onSearchChange={setSearch}
        visibility={config.visibility}
        onVisibilityChange={(v) => setConfig((p) => ({ ...p, visibility: v }))}
        sorting={config.sorting}
        onSortingChange={(s) => setConfig((p) => ({ ...p, sorting: s }))}
        columnFilters={config.columnFilters}
        onColumnFiltersChange={(f) =>
          setConfig((p) => ({ ...p, columnFilters: f }))
        }
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
        grouping={config.grouping}
        onGroupingChange={(g) => setConfig((p) => ({ ...p, grouping: g }))}
        filterRenderers={{
          bezeichnung: TextFilter,
          kategorie: TextFilter,
          objekt: TextFilter,
          beschreibung: TextFilter,
          aktiv: (props) => (
            <SelectFilter
              {...props}
              options={[
                { value: 'aktiv', label: 'aktiv' },
                { value: 'inaktiv', label: 'inaktiv' },
              ]}
            />
          ),
        }}
        enableRowSelection
        getRowId={(a) => a.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        bulkActions={(selected) => (
          <button
            type="button"
            onClick={() => setBulkConfirm(selected)}
            disabled={bulkDeleteMut.isPending}
            className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Löschen ({selected.length})
          </button>
        )}
        count={{
          filtered: data.length,
          total: listQuery.data?.length ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="anlagen"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Bezeichnung, Beschreibung …"
        showFooter
        itemLabel={{ singular: 'Anlage', plural: 'Anlagen' }}
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Anlage löschen?'
            : `${bulkConfirm?.length ?? 0} Anlagen löschen?`
        }
        message={
          bulkConfirm && bulkConfirm.length === 1 ? (
            <span>
              Anlage <strong>{bulkConfirm[0]?.bezeichnung}</strong> wirklich
              löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </span>
          ) : (
            <span>
              {bulkConfirm?.length ?? 0} ausgewählte Anlagen werden
              unwiderruflich gelöscht.
            </span>
          )
        }
        busy={remove.isPending || bulkDeleteMut.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />

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
                <label className="block text-sm text-zinc-300">
                  Bezeichnung *
                </label>
                <input
                  type="text"
                  value={form.bezeichnung}
                  onChange={(e) =>
                    setForm({ ...form, bezeichnung: e.target.value })
                  }
                  placeholder="z. B. RLT-03 oder Heizkreis Süd"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">
                  Beschreibung
                </label>
                <textarea
                  rows={2}
                  value={form.beschreibung ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, beschreibung: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-300">
                    Kategorie
                  </label>
                  <select
                    value={form.kategorie_wert_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        kategorie_wert_id: e.target.value || null,
                      })
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
                    onChange={(e) =>
                      setForm({ ...form, icon_name: e.target.value })
                    }
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
                  onChange={(e) =>
                    setForm({ ...form, objekt_id: e.target.value || null })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, aktiv: e.target.checked })
                  }
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
                disabled={
                  !form.bezeichnung.trim() ||
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
