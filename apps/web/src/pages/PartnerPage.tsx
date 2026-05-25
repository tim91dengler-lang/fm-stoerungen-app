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
import { Plus } from 'lucide-react';
import { adresseApi, partnerApi } from '../api/endpoints';
import type {
  PartnerCreate,
  PartnerRead,
  PartnerTyp,
  PartnerUpdate,
} from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

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
  columnOrder: ['name', 'typen', 'ansprechpartner', 'kontakt'],
  columnFilters: [],
  grouping: [],
};

const PARTNER_TYPEN: PartnerTyp[] = [
  'mieter',
  'eigentuemer',
  'auftraggeber',
  'nachunternehmer',
];

const TYP_LABEL: Record<PartnerTyp, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
};

const EMPTY_FORM: PartnerCreate = {
  name: '',
  ansprechpartner: '',
  email: '',
  telefon: '',
  adresse_id: null,
  notiz: '',
  typen: [],
};

export function PartnerPage() {
  const [search, setSearch] = useState('');
  const [typenFilter, setTypenFilter] = useState<PartnerTyp[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCreate>(EMPTY_FORM);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<PartnerRead[] | null>(null);
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
    queryKey: ['partner', search, typenFilter],
    queryFn: () =>
      partnerApi.list({
        search: search || undefined,
        typ: typenFilter.length > 0 ? typenFilter : undefined,
        limit: 200,
      }),
  });

  const adressenQuery = useQuery({
    queryKey: ['adressen-for-partner'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => partnerApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => partnerApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
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
      ansprechpartner: p.ansprechpartner ?? '',
      email: p.email ?? '',
      telefon: p.telefon ?? '',
      adresse_id: p.adresse_id,
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
      ansprechpartner: form.ansprechpartner || null,
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
        cell: (ctx) => (
          <span
            className="cursor-pointer font-medium text-zinc-100 hover:text-emerald-300"
            onClick={() => openEdit(ctx.row.original)}
          >
            {ctx.row.original.name}
          </span>
        ),
      },
      {
        id: 'typen',
        accessorFn: (row) => row.typen,
        header: 'Typen',
        // Multi-select filter against array column needs arrIncludesSome.
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
        id: 'ansprechpartner',
        accessorKey: 'ansprechpartner',
        header: 'Ansprechpartner',
        filterFn: 'includesString',
        cell: (ctx) => ctx.row.original.ansprechpartner ?? <span className="text-zinc-500">—</span>,
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
    [],
  );

  function confirmBulkDelete() {
    if (!bulkConfirm) return;
    if (bulkConfirm.length === 1 && bulkConfirm[0] !== undefined) {
      deleteMut.mutate(bulkConfirm[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(bulkConfirm.map((p) => p.id));
    }
  }

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

      <div className="flex flex-wrap gap-1">
        {PARTNER_TYPEN.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleTypFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              typenFilter.includes(t)
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {TYP_LABEL[t]}
          </button>
        ))}
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
        searchPlaceholder="Suche in Name, Ansprechpartner, E-Mail …"
        showFooter
        itemLabel={{ singular: 'Partner', plural: 'Partner' }}
      />


      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Partner löschen?'
            : `${bulkConfirm?.length ?? 0} Partner löschen?`
        }
        message={
          bulkConfirm && bulkConfirm.length === 1 ? (
            <span>
              Partner <strong>{bulkConfirm[0]?.name}</strong> wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </span>
          ) : (
            <span>
              {bulkConfirm?.length ?? 0} ausgewählte Partner werden
              unwiderruflich gelöscht.
            </span>
          )
        }
        busy={deleteMut.isPending || bulkDeleteMut.isPending}
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
            className="w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
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
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
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
                      className="inline-flex cursor-pointer items-center gap-1 text-sm"
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
                    Ansprechpartner
                  </label>
                  <input
                    type="text"
                    value={form.ansprechpartner ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, ansprechpartner: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
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
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adresse (optional)
                </label>
                <select
                  value={form.adresse_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, adresse_id: e.target.value || null })
                  }
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                >
                  <option value="">— Keine —</option>
                  {adressenQuery.data?.items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.strasse}
                      {a.hausnummer ? ` ${a.hausnummer}` : ''}, {a.plz} {a.ort}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Notiz
                </label>
                <textarea
                  rows={2}
                  value={form.notiz ?? ''}
                  onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm"
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
