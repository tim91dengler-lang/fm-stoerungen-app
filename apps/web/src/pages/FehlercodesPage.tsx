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
import { AlertOctagon, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  anlageApi,
  auswahllistenApi,
  fehlercodeApi,
  tickettypApi,
} from '../api/endpoints';
import type {
  FehlercodeCreate,
  FehlercodeRead,
  FehlercodeUpdate,
} from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import {
  MassEditModal,
  type ColumnSpec,
  type MassEditResult,
} from '../core/liste/MassEditModal';

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

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'code', desc: false }],
  visibility: {},
  columnOrder: [
    'code',
    'titel',
    'kategorie',
    'prio_default',
    'anlage',
    'quelle',
    'nutzung_count',
    'aktiv',
    '__actions__',
  ],
  columnFilters: [],
  grouping: [],
};

export function FehlercodesPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FehlercodeCreate>(EMPTY_FORM);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<FehlercodeRead[] | null>(null);
  const [massEditRows, setMassEditRows] = useState<FehlercodeRead[] | null>(
    null,
  );
  const [blockedNote, setBlockedNote] = useState<string | null>(null);
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
  const kategorienListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'ticket_kategorie',
  );
  const prioListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'ticket_prioritaet',
  );

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

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => fehlercodeApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fehlercodes'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

  // Mass-edit options use UUID values, because backend expects *_wert_id (UUID).
  const kategorieOptions = useMemo(
    () =>
      (kategorienListe?.werte ?? [])
        .filter((w) => w.ist_aktiv)
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((w) => ({ value: w.id, label: w.label })),
    [kategorienListe],
  );
  const prioOptions = useMemo(
    () =>
      (prioListe?.werte ?? [])
        .filter((w) => w.ist_aktiv)
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((w) => ({ value: w.id, label: w.label })),
    [prioListe],
  );

  const massEditColumns: ColumnSpec[] = [
    {
      id: 'kategorie_wert_id',
      label: 'Kategorie',
      type: 'auswahl',
      options: kategorieOptions,
    },
    {
      id: 'prio_default_wert_id',
      label: 'Priorität (Default)',
      type: 'auswahl',
      options: prioOptions,
    },
    { id: 'aktiv', label: 'Aktiv', type: 'boolean' },
  ];

  async function handleMassEdit(
    rows: FehlercodeRead[],
    columnId: string,
    value: unknown,
  ): Promise<MassEditResult> {
    const payload: FehlercodeUpdate = { [columnId]: value } as FehlercodeUpdate;
    const results = await Promise.allSettled(
      rows.map((r) => fehlercodeApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['fehlercodes'] });
    setRowSelection({});
    return { ok, failed: results.length - ok };
  }

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

  // Backend returns Array (not PaginatedResponse) for /fehlercodes.
  const data = listQuery.data ?? [];

  const columns = useMemo<ColumnDef<FehlercodeRead>[]>(
    () => [
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Code',
        filterFn: 'includesString',
        cell: (ctx) => (
          <button
            type="button"
            onClick={() => openEdit(ctx.row.original)}
            className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-emerald-300 hover:bg-zinc-700"
          >
            {ctx.row.original.code}
          </button>
        ),
      },
      {
        id: 'titel',
        accessorKey: 'titel',
        header: 'Titel',
        filterFn: 'includesString',
        cell: (ctx) => {
          const f = ctx.row.original;
          return (
            <div>
              <div className="font-medium text-zinc-100">{f.titel}</div>
              {f.beschreibung && (
                <div className="line-clamp-1 text-xs text-zinc-500">
                  {f.beschreibung}
                </div>
              )}
            </div>
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
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
              {k.label}
            </span>
          );
        },
      },
      {
        id: 'prio_default',
        accessorFn: (row) => row.prio_default?.label ?? '',
        header: 'Priorität (Default)',
        filterFn: 'includesString',
        cell: (ctx) => {
          const p = ctx.row.original.prio_default;
          if (!p) return <span className="text-zinc-500">—</span>;
          return (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
              {p.label}
            </span>
          );
        },
      },
      {
        id: 'anlage',
        accessorFn: (row) => row.anlage?.bezeichnung ?? '',
        header: 'Anlage',
        filterFn: 'includesString',
        cell: (ctx) =>
          ctx.row.original.anlage?.bezeichnung ?? (
            <span className="text-zinc-500">—</span>
          ),
      },
      {
        id: 'quelle',
        accessorKey: 'quelle',
        header: 'Quelle',
        filterFn: 'includesString',
        cell: (ctx) =>
          ctx.row.original.quelle ?? <span className="text-zinc-500">—</span>,
      },
      {
        id: 'nutzung_count',
        accessorKey: 'nutzung_count',
        header: 'Verwendet',
        cell: (ctx) => (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
            {ctx.row.original.nutzung_count}×
          </span>
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
              onClick={() => {
                const f = ctx.row.original;
                if (f.nutzung_count > 0) {
                  setBlockedNote(
                    `Fehlercode "${f.code}" wird von ${f.nutzung_count} Ticket${
                      f.nutzung_count === 1 ? '' : 's'
                    } referenziert. Bitte zuerst deaktivieren statt löschen.`,
                  );
                  return;
                }
                setBulkConfirm([f]);
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
    [],
  );

  function confirmBulkDelete() {
    if (!bulkConfirm) return;
    // Filter out fehlercodes that are still referenced (nutzung_count > 0)
    const deletable = bulkConfirm.filter((f) => f.nutzung_count === 0);
    if (deletable.length === 0) {
      setBulkConfirm(null);
      setBlockedNote(
        'Keiner der ausgewählten Fehlercodes ist löschbar — alle werden noch referenziert.',
      );
      return;
    }
    if (deletable.length === 1 && deletable[0] !== undefined) {
      remove.mutate(deletable[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(deletable.map((f) => f.id));
    }
  }

  // Pre-compute which selected rows would be skipped because of nutzung_count > 0
  function bulkBlockedCount(): number {
    if (!bulkConfirm) return 0;
    return bulkConfirm.filter((f) => f.nutzung_count > 0).length;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
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

      <PowerListenView<FehlercodeRead>
        viewKey="fehlercodes"
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
          code: TextFilter,
          titel: TextFilter,
          kategorie: TextFilter,
          prio_default: TextFilter,
          anlage: TextFilter,
          quelle: TextFilter,
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
        getRowId={(f) => f.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        bulkActions={(selected) => (
          <>
            <button
              type="button"
              onClick={() => setMassEditRows(selected)}
              className="rounded-md border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              Bearbeiten ({selected.length})
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm(selected)}
              disabled={bulkDeleteMut.isPending}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Löschen ({selected.length})
            </button>
          </>
        )}
        count={{
          filtered: data.length,
          total: listQuery.data?.length ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="fehlercodes"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Code, Titel, Beschreibung …"
        showFooter
        itemLabel={{ singular: 'Fehlercode', plural: 'Fehlercodes' }}
      />

      <MassEditModal<FehlercodeRead>
        open={massEditRows !== null}
        selectedRows={massEditRows ?? []}
        columns={massEditColumns}
        itemLabel={{ singular: 'Fehlercode', plural: 'Fehlercodes' }}
        onClose={() => setMassEditRows(null)}
        onSubmit={(col, val) =>
          handleMassEdit(massEditRows ?? [], col, val)
        }
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Fehlercode löschen?'
            : `${bulkConfirm?.length ?? 0} Fehlercodes löschen?`
        }
        message={
          <span>
            {bulkConfirm && bulkBlockedCount() > 0 && (
              <span className="mb-2 block text-xs text-amber-400">
                {bulkBlockedCount()} der ausgewählten Codes werden noch
                referenziert und übersprungen (bitte stattdessen deaktivieren).
              </span>
            )}
            {bulkConfirm && bulkConfirm.length === 1 ? (
              <>
                Fehlercode <strong>{bulkConfirm[0]?.code}</strong> wirklich
                löschen?
              </>
            ) : (
              <>
                {(bulkConfirm?.length ?? 0) - bulkBlockedCount()} Fehlercodes
                werden unwiderruflich gelöscht.
              </>
            )}
          </span>
        }
        busy={remove.isPending || bulkDeleteMut.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />

      <ConfirmDialog
        open={blockedNote !== null}
        title="Löschung blockiert"
        message={<span>{blockedNote}</span>}
        confirmLabel="OK"
        cancelLabel=""
        tone="primary"
        onConfirm={() => setBlockedNote(null)}
        onCancel={() => setBlockedNote(null)}
      />

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
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, titel: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-300">
                  Beschreibung
                </label>
                <textarea
                  rows={3}
                  value={form.beschreibung ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, beschreibung: e.target.value })
                  }
                  placeholder="Wird bei Ticket-Auswahl als Beschreibung übernommen."
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">
                  Lösungshinweis (intern)
                </label>
                <textarea
                  rows={3}
                  value={form.loesung ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, loesung: e.target.value })
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
                  <label className="block text-sm text-zinc-300">
                    Priorität (Default)
                  </label>
                  <select
                    value={form.prio_default_wert_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        prio_default_wert_id: e.target.value || null,
                      })
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
                    onChange={(e) =>
                      setForm({ ...form, anlage_id: e.target.value || null })
                    }
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
                  <label className="block text-sm text-zinc-300">
                    Tickettyp (Default)
                  </label>
                  <select
                    value={form.tickettyp_default_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tickettyp_default_id: e.target.value || null,
                      })
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
                    onChange={(e) =>
                      setForm({ ...form, quelle: e.target.value })
                    }
                    placeholder="z. B. Schartec, EBO"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
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
