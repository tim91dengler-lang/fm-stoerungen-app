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
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adresseApi } from '../api/endpoints';
import type {
  AdresseCreate,
  AdresseRead,
  AdresseSuggestion,
  AdresseUpdate,
} from '../api/types';
import { AdressSuggestCombobox } from '../components/AdressSuggestCombobox';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import {
  MassEditModal,
  type ColumnSpec,
  type MassEditResult,
} from '../core/liste/MassEditModal';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'strasse', desc: false }],
  visibility: {},
  columnOrder: ['strasse', 'plz_ort', 'land', 'geocode', '__actions__'],
  columnFilters: [],
  grouping: [],
};

const EMPTY_FORM: AdresseCreate = {
  strasse: '',
  hausnummer: '',
  adresszusatz: '',
  plz: '',
  ort: '',
  land: 'DE',
  bemerkung: '',
};

export function AdressenPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdresseCreate>(EMPTY_FORM);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<AdresseRead[] | null>(null);
  const [massEditRows, setMassEditRows] = useState<AdresseRead[] | null>(null);
  const qc = useQueryClient();

  const massEditColumns: ColumnSpec[] = [
    { id: 'land', label: 'Land', type: 'text' },
    { id: 'bemerkung', label: 'Bemerkung', type: 'text' },
  ];

  async function handleMassEdit(
    rows: AdresseRead[],
    columnId: string,
    value: unknown,
  ): Promise<MassEditResult> {
    const payload: AdresseUpdate = { [columnId]: value };
    const results = await Promise.allSettled(
      rows.map((r) => adresseApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['adressen'] });
    setRowSelection({});
    return { ok, failed: results.length - ok };
  }

  const listQuery = useQuery({
    queryKey: ['adressen', search],
    queryFn: () => adresseApi.list({ search: search || undefined, limit: 100 }),
  });

  const createMut = useMutation({
    mutationFn: (payload: AdresseCreate) => adresseApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adressen'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: AdresseCreate }) =>
      adresseApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adressen'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adresseApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adressen'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => adresseApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adressen'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSuggestQuery('');
    setShowModal(true);
  }

  function openEdit(adresse: AdresseRead) {
    setEditingId(adresse.id);
    setForm({
      strasse: adresse.strasse,
      hausnummer: adresse.hausnummer ?? '',
      adresszusatz: adresse.adresszusatz ?? '',
      plz: adresse.plz,
      ort: adresse.ort,
      land: adresse.land,
      bemerkung: adresse.bemerkung ?? '',
      latitude: adresse.latitude,
      longitude: adresse.longitude,
      geocode_source: adresse.geocode_source,
    });
    setSuggestQuery(`${adresse.strasse}${adresse.hausnummer ? ' ' + adresse.hausnummer : ''}`);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function applySuggestion(s: AdresseSuggestion) {
    setForm((prev) => ({
      ...prev,
      strasse: s.strasse ?? prev.strasse,
      hausnummer: s.hausnummer ?? prev.hausnummer,
      plz: s.plz ?? prev.plz,
      ort: s.ort ?? prev.ort,
      land: (s.land ?? prev.land ?? 'DE').toUpperCase(),
      latitude: s.latitude,
      longitude: s.longitude,
      geocode_source: 'photon',
    }));
    setSuggestQuery(s.label);
  }

  function handleSubmit() {
    if (editingId) {
      updateMut.mutate({ id: editingId, payload: form });
    } else {
      createMut.mutate(form);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const columns = useMemo<ColumnDef<AdresseRead>[]>(
    () => [
      {
        id: 'strasse',
        accessorFn: (row) => `${row.strasse} ${row.hausnummer ?? ''}`.trim(),
        header: 'Straße',
        filterFn: 'includesString',
        cell: (ctx) => {
          const a = ctx.row.original;
          return (
            <span
              className="cursor-pointer font-medium text-zinc-100 hover:text-emerald-300"
              onClick={() => openEdit(a)}
            >
              {a.strasse}
              {a.hausnummer ? ` ${a.hausnummer}` : ''}
              {a.adresszusatz && (
                <span className="ml-1 text-xs text-zinc-500">({a.adresszusatz})</span>
              )}
            </span>
          );
        },
      },
      {
        id: 'plz_ort',
        accessorFn: (row) => `${row.plz} ${row.ort}`,
        header: 'PLZ / Ort',
        filterFn: 'includesString',
        cell: (ctx) => `${ctx.row.original.plz} ${ctx.row.original.ort}`,
      },
      {
        id: 'land',
        accessorKey: 'land',
        header: 'Land',
        filterFn: 'includesString',
        cell: (ctx) => (
          <span className="font-mono text-xs uppercase">{ctx.row.original.land}</span>
        ),
      },
      {
        id: 'geocode',
        accessorFn: (row) => (row.latitude && row.longitude ? 'ja' : 'nein'),
        header: 'Geocode',
        filterFn: 'includesString',
        cell: (ctx) => {
          const a = ctx.row.original;
          return a.latitude && a.longitude ? (
            <span className="text-xs text-zinc-400">
              {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
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
      deleteMut.mutate(bulkConfirm[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(bulkConfirm.map((a) => a.id));
    }
  }

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Adressen</h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.total} Adressen` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neue Adresse
        </button>
      </div>

      <PowerListenView<AdresseRead>
        viewKey="adressen"
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
          strasse: TextFilter,
          plz_ort: TextFilter,
          land: TextFilter,
          geocode: TextFilter,
        }}
        enableRowSelection
        getRowId={(a) => a.id}
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
          filtered: listQuery.data?.items.length ?? 0,
          total: listQuery.data?.total ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="adressen"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Straße, PLZ, Ort …"
        showFooter
        itemLabel={{ singular: 'Adresse', plural: 'Adressen' }}
      />

      <MassEditModal<AdresseRead>
        open={massEditRows !== null}
        selectedRows={massEditRows ?? []}
        columns={massEditColumns}
        itemLabel={{ singular: 'Adresse', plural: 'Adressen' }}
        onClose={() => setMassEditRows(null)}
        onSubmit={(col, val) =>
          handleMassEdit(massEditRows ?? [], col, val)
        }
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Adresse löschen?'
            : `${bulkConfirm?.length ?? 0} Adressen löschen?`
        }
        message={
          bulkConfirm && bulkConfirm.length === 1 ? (
            <span>
              Adresse <strong>{bulkConfirm[0]?.strasse}</strong> wirklich
              löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </span>
          ) : (
            <span>
              {bulkConfirm?.length ?? 0} ausgewählte Adressen werden
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
            className="w-full max-w-xl rounded-xl bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {editingId ? 'Adresse bearbeiten' : 'Neue Adresse'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adress-Suche (Photon)
                </label>
                <AdressSuggestCombobox
                  value={suggestQuery}
                  onChange={setSuggestQuery}
                  onSelect={applySuggestion}
                  country={form.land?.toLowerCase()}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Straße
                  </label>
                  <input
                    type="text"
                    value={form.strasse}
                    onChange={(e) =>
                      setForm({ ...form, strasse: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Hausnummer
                  </label>
                  <input
                    type="text"
                    value={form.hausnummer ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, hausnummer: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Adresszusatz (z. B. Hinterhaus, 3. OG)
                </label>
                <input
                  type="text"
                  value={form.adresszusatz ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, adresszusatz: e.target.value })
                  }
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={form.plz}
                    onChange={(e) => setForm({ ...form, plz: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Ort
                  </label>
                  <input
                    type="text"
                    value={form.ort}
                    onChange={(e) => setForm({ ...form, ort: e.target.value })}
                    className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Land (ISO 2-Letter)
                </label>
                <input
                  type="text"
                  value={form.land ?? 'DE'}
                  onChange={(e) =>
                    setForm({ ...form, land: e.target.value.toUpperCase() })
                  }
                  className="w-24 rounded-md border border-zinc-700 px-3 py-2 text-sm uppercase"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Bemerkung
                </label>
                <textarea
                  value={form.bemerkung ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, bemerkung: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>

              {(form.latitude !== null && form.latitude !== undefined) && (
                <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Geocodiert via {form.geocode_source ?? 'photon'} —{' '}
                  {form.latitude?.toFixed(4)}, {form.longitude?.toFixed(4)}
                </div>
              )}
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
                disabled={isPending}
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
