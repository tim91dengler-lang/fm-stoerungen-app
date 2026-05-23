import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adresseApi } from '../api/endpoints';
import type {
  AdresseCreate,
  AdresseRead,
  AdresseSuggestion,
} from '../api/types';
import { AdressSuggestCombobox } from '../components/AdressSuggestCombobox';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter } from '../core/liste/columnFilters';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'strasse', desc: false }],
  visibility: {},
  columnOrder: ['strasse', 'plz_ort', 'land', 'geocode', '__actions__'],
};

// Stabile Konstanten — verhindern, dass bei jedem Render neue
// Array/Function-Identitäten an PowerListenView gegeben werden, was
// einen TanStack-Table-Loop triggert.
const EMPTY_FILTERS: ColumnFiltersState = [];
const NOOP_FILTER_CHANGE = (): void => undefined;

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
  const qc = useQueryClient();

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
        cell: (ctx) => `${ctx.row.original.plz} ${ctx.row.original.ort}`,
      },
      {
        id: 'land',
        accessorKey: 'land',
        header: 'Land',
        cell: (ctx) => (
          <span className="font-mono text-xs uppercase">{ctx.row.original.land}</span>
        ),
      },
      {
        id: 'geocode',
        accessorFn: (row) => (row.latitude && row.longitude ? 'ja' : 'nein'),
        header: 'Geocode',
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
                if (confirm(`Adresse "${ctx.row.original.strasse}" löschen?`))
                  deleteMut.mutate(ctx.row.original.id);
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
    // openEdit + deleteMut are stable enough; columns rebuild on every render is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
        columnFilters={EMPTY_FILTERS}
        onColumnFiltersChange={NOOP_FILTER_CHANGE}
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
        filterRenderers={{
          strasse: TextFilter,
          plz_ort: TextFilter,
          land: TextFilter,
        }}
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
