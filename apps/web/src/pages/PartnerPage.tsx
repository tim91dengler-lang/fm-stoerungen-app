import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { partnerApi } from '../api/endpoints';
import type {
  PartnerCreate,
  PartnerRead,
  PartnerTyp,
  PartnerUpdate,
} from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';

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
  columnOrder: ['name', 'typen', 'gehoert_zu', 'ansprechpartner', 'kontakt'],
  columnFilters: [],
  grouping: [],
};

const PARTNER_TYPEN: PartnerTyp[] = [
  'mieter',
  'eigentuemer',
  'auftraggeber',
  'nachunternehmer',
  'privatperson',
];

const TYP_LABEL: Record<PartnerTyp, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
  privatperson: 'Privatperson',
};

type GesperrtFilter = 'aktiv' | 'gesperrt' | 'alle';

const EMPTY_FORM: PartnerCreate = {
  name: '',
  email: '',
  telefon: '',
  notiz: '',
  typen: [],
};

export function PartnerPage() {
  const [search, setSearch] = useState('');
  const [typenFilter, setTypenFilter] = useState<PartnerTyp[]>([]);
  const [gesperrtFilter, setGesperrtFilter] = useState<GesperrtFilter>('aktiv');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCreate>(EMPTY_FORM);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const qc = useQueryClient();

  async function handleMassEdit(
    columnId: string,
    value: unknown,
    rows: PartnerRead[],
  ): Promise<{ ok: number; failed: number }> {
    const payload: PartnerUpdate = { [columnId]: value } as PartnerUpdate;
    const results = await Promise.allSettled(
      rows.map((r) => partnerApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['partner'] });
    return { ok, failed: results.length - ok };
  }

  const listQuery = useQuery({
    queryKey: ['partner', search, typenFilter, gesperrtFilter],
    queryFn: () =>
      partnerApi.list({
        search: search || undefined,
        typ: typenFilter.length > 0 ? typenFilter : undefined,
        gesperrt_filter: gesperrtFilter,
        limit: 200,
      }),
  });

  // Map id → name für „Gehört zu"-Spalte. Bei Filter-Wechsel kann
  // ein Parent außerhalb der aktuellen Liste liegen — dann fällt der Wert
  // auf die UUID zurück. Für die Detail-Seite (Phase 6c-Detail) wird das
  // sauber per Backend-Resolution gelöst.
  const partnerById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of listQuery.data?.items ?? []) m.set(p.id, p.name);
    return m;
  }, [listQuery.data]);

  const createMut = useMutation({
    mutationFn: (payload: PartnerCreate) => partnerApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: PartnerCreate }) =>
      partnerApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner'] });
      closeModal();
    },
  });

  const sperrenMut = useMutation({
    mutationFn: (vars: { id: string; sperren: boolean }) =>
      vars.sperren ? partnerApi.sperren(vars.id) : partnerApi.entsperren(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p: PartnerRead) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      email: p.email ?? '',
      telefon: p.telefon ?? '',
      notiz: p.notiz ?? '',
      typen: p.typen,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function toggleTypInForm(t: PartnerTyp) {
    setForm((prev) => ({
      ...prev,
      typen: prev.typen.includes(t)
        ? prev.typen.filter((x) => x !== t)
        : [...prev.typen, t],
    }));
  }

  function toggleTypFilter(t: PartnerTyp) {
    setTypenFilter((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    );
  }

  function handleSubmit() {
    const payload: PartnerCreate = {
      ...form,
      email: form.email || null,
      telefon: form.telefon || null,
      notiz: form.notiz || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, payload });
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const columns = useMemo<ColumnDef<PartnerRead>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        filterFn: 'includesString',
        cell: (ctx) => {
          const p = ctx.row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                to={`/stammdaten/partner/${p.id}`}
                className={clsx(
                  'font-medium hover:text-emerald-300',
                  p.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-100',
                )}
              >
                {p.name}
              </Link>
              {p.gesperrt && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                  gesperrt
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'typen',
        accessorFn: (row) => row.typen,
        header: 'Typen',
        filterFn: 'arrIncludesSome',
        meta: {
          massEdit: {
            type: 'auswahl' as const,
            options: PARTNER_TYPEN.map((t) => ({ value: t, label: TYP_LABEL[t] })),
          },
        },
        cell: (ctx) => (
          <div className="flex flex-wrap gap-1">
            {ctx.row.original.typen.map((t) => (
              <span
                key={t}
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
              >
                {TYP_LABEL[t]}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'gehoert_zu',
        accessorFn: (row) => row.parent_partner_id ?? '',
        header: 'Gehört zu',
        cell: (ctx) => {
          const pid = ctx.row.original.parent_partner_id;
          if (!pid) return <span className="text-zinc-600">—</span>;
          const name = partnerById.get(pid);
          return (
            <span className="text-sm text-zinc-300">
              {name ?? <span className="font-mono text-xs">{pid.slice(0, 8)}…</span>}
            </span>
          );
        },
      },
      {
        id: 'ansprechpartner',
        accessorKey: 'ansprechpartner',
        header: 'Hauptkontakt',
        filterFn: 'includesString',
        cell: (ctx) =>
          ctx.row.original.ansprechpartner ?? (
            <span className="text-zinc-500">—</span>
          ),
      },
      {
        id: 'kontakt',
        accessorFn: (row) => `${row.email ?? ''} ${row.telefon ?? ''}`.trim(),
        header: 'Kontakt',
        filterFn: 'includesString',
        cell: (ctx) => {
          const p = ctx.row.original;
          return (
            <div className="text-xs text-zinc-400">
              <div>{p.email ?? '—'}</div>
              <div>{p.telefon ?? '—'}</div>
            </div>
          );
        },
      },
    ],
    [partnerById],
  );

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Geschäftspartner</h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.total} Partner` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neuer Partner
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Typen-Filter (Pills) */}
        <div className="flex flex-wrap gap-1">
          {PARTNER_TYPEN.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTypFilter(t)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium',
                typenFilter.includes(t)
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
              )}
            >
              {TYP_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Sperren-Status-Toggle (R6c-Konvention) */}
        <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-700 p-0.5">
          {(['aktiv', 'gesperrt', 'alle'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setGesperrtFilter(f)}
              className={clsx(
                'rounded px-2.5 py-1 text-xs font-medium',
                gesperrtFilter === f
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {f === 'aktiv' ? 'Aktive' : f === 'gesperrt' ? 'Gesperrte' : 'Alle'}
            </button>
          ))}
        </div>
      </div>

      <PowerListenView<PartnerRead>
        viewKey="partner"
        columns={columns}
        data={listQuery.data?.items ?? []}
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
          name: TextFilter,
          ansprechpartner: TextFilter,
          kontakt: TextFilter,
          gehoert_zu: TextFilter,
          typen: (props) => (
            <SelectFilter
              {...props}
              options={PARTNER_TYPEN.map((t) => ({ value: t, label: TYP_LABEL[t] }))}
            />
          ),
        }}
        enableRowSelection
        getRowId={(p) => p.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        rowActions={{
          onEdit: openEdit,
          sperren: {
            isGesperrt: (p) => p.gesperrt,
            onToggle: (p) =>
              sperrenMut.mutate({ id: p.id, sperren: !p.gesperrt }),
          },
        }}
        bulkActions={(selected) => (
          <button
            type="button"
            onClick={() => {
              // Bulk-Sperren — rekursiv pro Partner über die Backend-API
              selected.forEach((p) =>
                sperrenMut.mutate({ id: p.id, sperren: true }),
              );
              setRowSelection({});
            }}
            disabled={sperrenMut.isPending}
            className="rounded-md border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Sperren ({selected.length})
          </button>
        )}
        onMassEdit={handleMassEdit}
        count={{
          filtered: listQuery.data?.items.length ?? 0,
          total: listQuery.data?.total ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="partner"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Name, Kontakt, E-Mail …"
        showFooter
        itemLabel={{ singular: 'Partner', plural: 'Partner' }}
      />

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {editingId ? 'Partner bearbeiten' : 'Neuer Partner'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Typen
                </label>
                <div className="flex flex-wrap gap-2">
                  {PARTNER_TYPEN.map((t) => (
                    <label
                      key={t}
                      className="inline-flex cursor-pointer items-center gap-1 text-sm text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={form.typen.includes(t)}
                        onChange={() => toggleTypInForm(t)}
                      />
                      {TYP_LABEL[t]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={form.telefon ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, telefon: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Notiz
                </label>
                <textarea
                  rows={2}
                  value={form.notiz ?? ''}
                  onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <p className="text-[10px] text-zinc-500">
                Kontaktpersonen, Adressen, Filialen und weitere Stammdaten werden
                in der Detail-Ansicht des Partners gepflegt (folgt in Phase 6c-Detail).
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !form.name}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isPending ? 'Speichere …' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
