import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Building2, Calendar, FolderKanban, Plus } from 'lucide-react';
import clsx from 'clsx';
import { auswahllistenApi, projektApi, userApi } from '../api/endpoints';
import type {
  AuswahllistenWertRead,
  ProjektCreate,
  ProjektRead,
  ProjektUpdate,
} from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import { selectFilter } from '../core/felder/listFields';
import { isModulStandard } from '../core/featureFlags';
import { ProjektDetailOverlay } from '../components/projekt/ProjektDetailOverlay';
import { ProjektModal } from '../components/ProjektModal';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'name', desc: false }],
  visibility: {},
  columnOrder: [
    'name',
    'projekttyp',
    'status',
    'verantwortlich',
    'zeitraum',
    'objekte',
    'ticket_count',
    '__actions__',
  ],
  columnFilters: [],
  grouping: [],
};

/**
 * Default farbe for an AuswahlWertRef when the seed has no color.
 * Status-Slugs aus Seed: geplant, aktiv, pausiert, abgeschlossen.
 */
const STATUS_FALLBACK_COLOR: Record<string, string> = {
  geplant: 'sky',
  aktiv: 'emerald',
  pausiert: 'amber',
  abgeschlossen: 'zinc',
};

function colorClasses(farbe: string | null): string {
  switch (farbe) {
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'sky':
    case 'blue':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'amber':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'red':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'violet':
    case 'purple':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'zinc':
    default:
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  }
}

function statusColorClasses(key: string, farbe: string | null): string {
  const resolved = farbe ?? STATUS_FALLBACK_COLOR[key] ?? null;
  return colorClasses(resolved);
}

interface PillProps {
  label: string;
  farbe: string | null;
}

function Pill({ label, farbe }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        colorClasses(farbe),
      )}
    >
      {label}
    </span>
  );
}

function StatusPill({
  keyValue,
  label,
  farbe,
}: {
  keyValue: string;
  label: string;
  farbe: string | null;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        statusColorClasses(keyValue, farbe),
      )}
    >
      {label}
    </span>
  );
}

function activeWerte(liste: { werte: AuswahllistenWertRead[] } | undefined) {
  if (!liste) return [];
  return [...liste.werte]
    .filter((w) => w.ist_aktiv)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

export function ProjektePage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProjektRead | null>(null);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // Master-Layout-Standard (Slice 1, hinter Flag): Klick öffnet zentriertes
  // Detail-Overlay statt Navigation zur Detail-Seite.
  const modulStandard = isModulStandard();
  const [openProjektId, setOpenProjektId] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<ProjektRead[] | null>(null);
  const [bulkStatusModal, setBulkStatusModal] = useState<{
    rows: ProjektRead[];
    statusSlug: string;
  } | null>(null);
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['projekte'],
    queryFn: () => projektApi.list(),
  });

  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-projekt-filter'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const projekttypListe = auswahllisten?.find((l) => l.key === 'projekttyp');
  const statusListe = auswahllisten?.find((l) => l.key === 'projektstatus');
  const projekttypOptions = activeWerte(projekttypListe);
  const statusOptions = activeWerte(statusListe);

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.beschreibung ?? '').toLowerCase().includes(q) ||
        p.projekttyp.label.toLowerCase().includes(q) ||
        p.status.label.toLowerCase().includes(q) ||
        (p.verantwortlich?.full_name ?? '').toLowerCase().includes(q) ||
        p.objekte.some((o) => o.name.toLowerCase().includes(q)),
    );
  }, [listQuery.data, search]);

  const create = useMutation({
    mutationFn: (payload: ProjektCreate) => projektApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setShowModal(false);
      setEditing(null);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjektCreate }) =>
      projektApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setShowModal(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => projektApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projekte'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => projektApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

  const bulkStatusMut = useMutation({
    mutationFn: async (vars: { ids: string[]; statusSlug: string }) => {
      await Promise.all(
        vars.ids.map((id) => projektApi.update(id, { status_slug: vars.statusSlug })),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setRowSelection({});
      setBulkStatusModal(null);
    },
  });

  // Mass-edit options: projektstatus / projekttyp send slugs (not UUIDs)
  // — the backend payload uses `status_slug` / `projekttyp_slug`.
  const statusSlugOptions = useMemo(
    () => statusOptions.map((w) => ({ value: w.key, label: w.label })),
    [statusOptions],
  );
  const projekttypSlugOptions = useMemo(
    () => projekttypOptions.map((w) => ({ value: w.key, label: w.label })),
    [projekttypOptions],
  );

  async function handleMassEdit(
    columnId: string,
    value: unknown,
    rows: ProjektRead[],
  ): Promise<{ ok: number; failed: number }> {
    // Map UI column ids → backend fields (status / projekttyp use _slug suffix).
    const field =
      columnId === 'status'
        ? 'status_slug'
        : columnId === 'projekttyp'
          ? 'projekttyp_slug'
          : columnId;
    const payload: ProjektUpdate = { [field]: value } as ProjektUpdate;
    const results = await Promise.allSettled(
      rows.map((r) => projektApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['projekte'] });
    return { ok, failed: results.length - ok };
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(p: ProjektRead) {
    setEditing(p);
    setShowModal(true);
  }

  function handleModalSubmit(payload: ProjektCreate) {
    if (editing) update.mutate({ id: editing.id, payload });
    else create.mutate(payload);
  }

  const columns = useMemo<ColumnDef<ProjektRead>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Projekt',
        filterFn: 'includesString',
        cell: (ctx) => {
          const p = ctx.row.original;
          return (
            <div>
              {modulStandard ? (
                <button
                  type="button"
                  onClick={() => setOpenProjektId(p.id)}
                  className="text-left font-medium text-zinc-100 hover:text-emerald-300"
                >
                  {p.name}
                </button>
              ) : (
                <Link
                  to={`/projekte/${p.id}`}
                  className="font-medium text-zinc-100 hover:text-emerald-300"
                >
                  {p.name}
                </Link>
              )}
              {p.beschreibung && (
                <div className="line-clamp-1 text-xs text-zinc-500">{p.beschreibung}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'projekttyp',
        accessorFn: (row) => row.projekttyp.key,
        header: 'Projekttyp',
        filterFn: 'arrIncludesSome',
        meta: {
          massEdit: {
            type: 'auswahl' as const,
            options: projekttypSlugOptions,
          },
        },
        cell: (ctx) => {
          const t = ctx.row.original.projekttyp;
          return <Pill label={t.label} farbe={t.farbe} />;
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row.status.key,
        header: 'Status',
        filterFn: 'arrIncludesSome',
        meta: {
          massEdit: {
            type: 'auswahl' as const,
            options: statusSlugOptions,
          },
        },
        cell: (ctx) => {
          const s = ctx.row.original.status;
          return <StatusPill keyValue={s.key} label={s.label} farbe={s.farbe} />;
        },
      },
      {
        id: 'verantwortlich',
        accessorFn: (row) => row.verantwortlich?.id ?? '',
        header: 'Verantwortlich',
        filterFn: 'arrIncludesSome',
        cell: (ctx) =>
          ctx.row.original.verantwortlich?.full_name ?? (
            <span className="text-zinc-500">—</span>
          ),
      },
      {
        id: 'zeitraum',
        accessorFn: (row) => `${row.start_am ?? ''} ${row.ende_am ?? ''}`,
        header: 'Zeitraum',
        filterFn: 'includesString',
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
        id: 'objekte',
        accessorFn: (row) => row.objekte.map((o) => o.name).join(' '),
        header: 'Objekte',
        filterFn: 'includesString',
        cell: (ctx) => {
          const objekte = ctx.row.original.objekte;
          if (objekte.length === 0) return <span className="text-zinc-500">—</span>;
          const first = objekte[0]!;
          const titleText = objekte.map((o) => o.name).join(', ');
          return (
            <span
              className="inline-flex items-center gap-1 text-xs text-zinc-300"
              title={titleText}
            >
              <Building2 className="h-3 w-3 text-emerald-400" />
              {first.name}
              {objekte.length > 1 && (
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  +{objekte.length - 1}
                </span>
              )}
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
    ],
    [projekttypSlugOptions, statusSlugOptions, modulStandard],
  );

  function confirmBulkDelete() {
    if (!bulkConfirm) return;
    if (bulkConfirm.length === 1 && bulkConfirm[0] !== undefined) {
      remove.mutate(bulkConfirm[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(bulkConfirm.map((p) => p.id));
    }
  }

  // Filter-Optionen pro Auswahllisten-Spalte
  const projekttypFilterOptions = useMemo(
    () => projekttypOptions.map((w) => ({ value: w.key, label: w.label })),
    [projekttypOptions],
  );
  const statusFilterOptions = useMemo(
    () => statusOptions.map((w) => ({ value: w.key, label: w.label })),
    [statusOptions],
  );
  const verantwortlichFilterOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? []).map((u) => ({
        value: u.id,
        label: u.full_name,
      })),
    [usersQuery.data],
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
            Bündel zusammengehöriger Tickets mit Verantwortlichem, Status und Objekten
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
        columnFilters={config.columnFilters}
        onColumnFiltersChange={(f) => setConfig((p) => ({ ...p, columnFilters: f }))}
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
        grouping={config.grouping}
        onGroupingChange={(g) => setConfig((p) => ({ ...p, grouping: g }))}
        filterRenderers={{
          name: TextFilter,
          zeitraum: TextFilter,
          objekte: TextFilter,
          projekttyp: selectFilter(projekttypFilterOptions),
          status: selectFilter(statusFilterOptions),
          verantwortlich: selectFilter(verantwortlichFilterOptions),
        }}
        enableRowSelection
        getRowId={(p) => p.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        rowActions={{
          onEdit: (p) => (modulStandard ? setOpenProjektId(p.id) : openEdit(p)),
          onDelete: (rows) => setBulkConfirm(rows),
        }}
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
        onMassEdit={handleMassEdit}
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

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Projekt löschen?'
            : `${bulkConfirm?.length ?? 0} Projekte löschen?`
        }
        message={
          bulkConfirm && bulkConfirm.length === 1 ? (
            <span>
              Projekt <strong>{bulkConfirm[0]?.name}</strong> wirklich löschen? Diese
              Aktion kann nicht rückgängig gemacht werden.
            </span>
          ) : (
            <span>
              {bulkConfirm?.length ?? 0} ausgewählte Projekte werden unwiderruflich
              gelöscht.
            </span>
          )
        }
        busy={remove.isPending || bulkDeleteMut.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />

      {bulkStatusModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={() => !bulkStatusMut.isPending && setBulkStatusModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-100">
              Status für {bulkStatusModal.rows.length} Projekt
              {bulkStatusModal.rows.length === 1 ? '' : 'e'} setzen
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Neuer Status für die ausgewählten Projekte:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {statusOptions.map((w) => {
                const active = bulkStatusModal.statusSlug === w.key;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      setBulkStatusModal({
                        ...bulkStatusModal,
                        statusSlug: w.key,
                      })
                    }
                    className={clsx(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                      active
                        ? statusColorClasses(w.key, w.farbe)
                        : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800',
                    )}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkStatusModal(null)}
                disabled={bulkStatusMut.isPending}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() =>
                  bulkStatusMut.mutate({
                    ids: bulkStatusModal.rows.map((p) => p.id),
                    statusSlug: bulkStatusModal.statusSlug,
                  })
                }
                disabled={bulkStatusMut.isPending}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {bulkStatusMut.isPending ? 'Setze …' : 'Status setzen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProjektModal
        open={showModal}
        initial={editing}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSubmit={handleModalSubmit}
        isPending={create.isPending || update.isPending}
      />

      {modulStandard && openProjektId && (
        <ProjektDetailOverlay
          projektId={openProjektId}
          onClose={() => setOpenProjektId(null)}
        />
      )}
    </div>
  );
}
