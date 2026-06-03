import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { adresseApi, objektApi, partnerApi } from '../api/endpoints';
import { isModulStandard } from '../core/featureFlags';
import { ObjektDetailOverlay } from '../components/objekt/ObjektDetailOverlay';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import type { ObjektCreate, ObjektRead, ObjektUpdate, PartnerTyp } from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter } from '../core/liste/columnFilters';

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
  columnOrder: ['name', 'adresse', 'partner'],
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

const EMPTY_FORM: ObjektCreate = {
  name: '',
  adresse_id: null,
  notiz: '',
  partner_links: [],
};

type GesperrtFilter = 'aktiv' | 'gesperrt' | 'alle';

export function ObjektePage() {
  const [search, setSearch] = useState('');
  const [gesperrtFilter, setGesperrtFilter] = useState<GesperrtFilter>('aktiv');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ObjektCreate>(EMPTY_FORM);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const modulStandard = isModulStandard();
  const [openObjektId, setOpenObjektId] = useState<string | null>(null);
  const [deaktivierenConfirm, setDeaktivierenConfirm] = useState<ObjektRead[] | null>(
    null,
  );
  const qc = useQueryClient();

  async function handleMassEdit(
    columnId: string,
    value: unknown,
    rows: ObjektRead[],
  ): Promise<{ ok: number; failed: number }> {
    const payload: ObjektUpdate = { [columnId]: value };
    const results = await Promise.allSettled(
      rows.map((r) => objektApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['objekte'] });
    return { ok, failed: results.length - ok };
  }

  const listQuery = useQuery({
    queryKey: ['objekte', search, gesperrtFilter],
    queryFn: () =>
      objektApi.list({
        search: search || undefined,
        gesperrt_filter: gesperrtFilter,
        limit: 100,
      }),
  });

  const adressenQuery = useQuery({
    queryKey: ['adressen-for-objekt'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const partnerQuery = useQuery({
    queryKey: ['partner-for-objekt'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const navigate = useNavigate();

  const createMut = useMutation({
    mutationFn: (payload: ObjektCreate) => objektApi.create(payload),
    onSuccess: (created) => {
      // Tims R4-Anforderung: nach Anlage direkt auf die Detail-Seite,
      // damit der User unmittelbar Häuser/Stockwerke/Einheiten anlegen kann.
      qc.invalidateQueries({ queryKey: ['objekte'] });
      closeModal();
      navigate(`/stammdaten/objekte/${created.id}`);
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: ObjektCreate }) =>
      objektApi.update(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objekte'] });
      closeModal();
    },
  });

  const sperrenMut = useMutation({
    mutationFn: (vars: { id: string; sperren: boolean }) =>
      vars.sperren ? objektApi.sperren(vars.id) : objektApi.entsperren(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekte'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(o: ObjektRead) {
    setEditingId(o.id);
    setForm({
      name: o.name,
      adresse_id: o.adresse_id,
      notiz: o.notiz ?? '',
      partner_links: o.partner_links.map((l) => ({
        partner_id: l.partner_id,
        rolle: l.rolle,
      })),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function addLink(partnerId: string, rolle: PartnerTyp) {
    if (!partnerId) return;
    setForm((prev) => ({
      ...prev,
      partner_links: [...(prev.partner_links ?? []), { partner_id: partnerId, rolle }],
    }));
  }

  function removeLink(idx: number) {
    setForm((prev) => ({
      ...prev,
      partner_links: (prev.partner_links ?? []).filter((_, i) => i !== idx),
    }));
  }

  function handleSubmit() {
    const payload: ObjektCreate = {
      ...form,
      notiz: form.notiz || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, payload });
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const columns = useMemo<ColumnDef<ObjektRead>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        filterFn: 'includesString',
        cell: (ctx) => {
          const o = ctx.row.original;
          return (
            <div className="flex items-center gap-2">
              {modulStandard ? (
                <button
                  type="button"
                  onClick={() => setOpenObjektId(o.id)}
                  className={clsx(
                    'text-left font-medium hover:text-emerald-300',
                    o.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-100',
                  )}
                >
                  {o.name}
                </button>
              ) : (
                <Link
                  to={`/stammdaten/objekte/${o.id}`}
                  className={clsx(
                    'font-medium hover:text-emerald-300',
                    o.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-100',
                  )}
                >
                  {o.name}
                </Link>
              )}
              {o.gesperrt && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                  deaktiviert
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'adresse',
        accessorFn: (row) =>
          row.adresse
            ? `${row.adresse.strasse} ${row.adresse.hausnummer ?? ''} ${row.adresse.plz} ${row.adresse.ort}`
            : '',
        header: 'Adresse',
        filterFn: 'includesString',
        cell: (ctx) => {
          const a = ctx.row.original.adresse;
          if (!a) return <span className="text-zinc-500">—</span>;
          return (
            <span className="text-zinc-400">
              {a.strasse}
              {a.hausnummer ? ` ${a.hausnummer}` : ''}, {a.plz} {a.ort}
            </span>
          );
        },
      },
      {
        id: 'partner',
        accessorFn: (row) => row.partner_links.map((l) => l.partner_name).join(' '),
        header: 'Partner (Objekt)',
        filterFn: 'includesString',
        cell: (ctx) => {
          const links = ctx.row.original.partner_links;
          if (links.length === 0) return <span className="text-zinc-500">—</span>;
          return (
            <span className="text-xs text-zinc-400">
              {links.map((l) => `${l.partner_name} (${TYP_LABEL[l.rolle]})`).join(', ')}
            </span>
          );
        },
      },
      {
        id: 'beteiligte',
        accessorFn: (row) =>
          row.beteiligte_summary
            .map((b) => `${b.partner_name} ${b.rolle_label ?? ''}`)
            .join(' '),
        header: 'Eigentümer/Beteiligte',
        filterFn: 'includesString',
        cell: (ctx) => {
          const bet = ctx.row.original.beteiligte_summary;
          if (bet.length === 0) return <span className="text-zinc-500">—</span>;
          return (
            <span className="text-xs text-zinc-400">
              {bet
                .map((b) =>
                  b.rolle_label ? `${b.partner_name} (${b.rolle_label})` : b.partner_name,
                )
                .join(', ')}
            </span>
          );
        },
      },
    ],
    [modulStandard],
  );

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Objekte</h1>
          <p className="text-sm text-zinc-500">
            {listQuery.data ? `${listQuery.data.total} Objekte` : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sperren-Status-Toggle (R6c-Konvention) */}
          <div className="inline-flex items-center gap-1 rounded-md border border-zinc-700 p-0.5">
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
                {f === 'aktiv' ? 'Aktive' : f === 'gesperrt' ? 'Deaktivierte' : 'Alle'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Neues Objekt
          </button>
        </div>
      </div>

      <PowerListenView<ObjektRead>
        viewKey="objekte"
        columns={columns}
        data={listQuery.data?.items ?? []}
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
          adresse: TextFilter,
          partner: TextFilter,
        }}
        enableRowSelection
        getRowId={(o) => o.id}
        rowSelection={rowSelection}
        rowActions={{
          onEdit: (o) => (modulStandard ? setOpenObjektId(o.id) : openEdit(o)),
          sperren: {
            isGesperrt: (o) => o.gesperrt,
            onToggle: (o) => {
              if (o.gesperrt) {
                sperrenMut.mutate({ id: o.id, sperren: false });
              } else {
                setDeaktivierenConfirm([o]);
              }
            },
          },
        }}
        onRowSelectionChange={setRowSelection}
        bulkActions={(selected) => (
          <button
            type="button"
            onClick={() => setDeaktivierenConfirm(selected)}
            disabled={sperrenMut.isPending}
            className="rounded-md border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Deaktivieren ({selected.length})
          </button>
        )}
        onMassEdit={handleMassEdit}
        count={{
          filtered: listQuery.data?.items.length ?? 0,
          total: listQuery.data?.total ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="objekte"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Objekten …"
        showFooter
        itemLabel={{ singular: 'Objekt', plural: 'Objekte' }}
      />

      <ConfirmDialog
        open={deaktivierenConfirm !== null}
        title={
          deaktivierenConfirm && deaktivierenConfirm.length === 1
            ? 'Objekt deaktivieren?'
            : `${deaktivierenConfirm?.length ?? 0} Objekte deaktivieren?`
        }
        message={
          deaktivierenConfirm && deaktivierenConfirm.length === 1 ? (
            <span>
              <strong>{deaktivierenConfirm[0]?.name}</strong> wird deaktiviert und ist
              nicht mehr für neue Verknüpfungen verfügbar. Bestehende Verknüpfungen
              bleiben.
            </span>
          ) : (
            <span>
              {deaktivierenConfirm?.length ?? 0} ausgewählte Objekte werden deaktiviert.
            </span>
          )
        }
        tone="danger"
        confirmLabel="Deaktivieren"
        busy={sperrenMut.isPending}
        onConfirm={() => {
          if (!deaktivierenConfirm) return;
          deaktivierenConfirm.forEach((o) =>
            sperrenMut.mutate({ id: o.id, sperren: true }),
          );
          setRowSelection({});
          setDeaktivierenConfirm(null);
        }}
        onCancel={() => setDeaktivierenConfirm(null)}
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
                {editingId ? 'Objekt bearbeiten' : 'Neues Objekt'}
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
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Im Create-Modus (Tim R5a) bewusst NUR Name fragen, alles
                  Weitere (Adresse, Notiz, Partner) auf der Detail-Seite
                  bearbeiten. Im Edit-Modus erscheinen die Felder weiterhin. */}
              {editingId !== null && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-300">
                      Adresse
                    </label>
                    <select
                      value={form.adresse_id ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, adresse_id: e.target.value || null })
                      }
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
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
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2 rounded-md border border-zinc-800 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Partner-Zuordnungen
                    </div>
                    {(form.partner_links ?? []).length === 0 && (
                      <div className="text-xs text-zinc-500">
                        Noch keine Partner zugeordnet.
                      </div>
                    )}
                    <ul className="space-y-1">
                      {(form.partner_links ?? []).map((l, idx) => {
                        const p = partnerQuery.data?.items.find(
                          (pp) => pp.id === l.partner_id,
                        );
                        return (
                          <li
                            key={`${l.partner_id}-${l.rolle}-${idx}`}
                            className="flex items-center justify-between rounded bg-zinc-900/50 px-2 py-1 text-sm"
                          >
                            <span>
                              {p?.name ?? l.partner_id} —{' '}
                              <span className="text-xs text-zinc-400">
                                {TYP_LABEL[l.rolle]}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLink(idx)}
                              className="text-xs text-red-400 hover:underline"
                            >
                              entfernen
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <PartnerLinkAdder
                      partnerOptions={(partnerQuery.data?.items ?? []).map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                      onAdd={addLink}
                    />
                  </div>
                </>
              )}
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

      {modulStandard && openObjektId && (
        <ObjektDetailOverlay
          objektId={openObjektId}
          onClose={() => setOpenObjektId(null)}
        />
      )}
    </div>
  );
}

function PartnerLinkAdder({
  partnerOptions,
  onAdd,
}: {
  partnerOptions: { id: string; name: string }[];
  onAdd: (partnerId: string, rolle: PartnerTyp) => void;
}) {
  const [partnerId, setPartnerId] = useState('');
  const [rolle, setRolle] = useState<PartnerTyp>('mieter');

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={partnerId}
        onChange={(e) => setPartnerId(e.target.value)}
        className="rounded-md border border-zinc-700 px-2 py-1 text-sm"
      >
        <option value="">— Partner wählen —</option>
        {partnerOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={rolle}
        onChange={(e) => setRolle(e.target.value as PartnerTyp)}
        className="rounded-md border border-zinc-700 px-2 py-1 text-sm"
      >
        {PARTNER_TYPEN.map((t) => (
          <option key={t} value={t}>
            {TYP_LABEL[t]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(partnerId, rolle);
          setPartnerId('');
        }}
        disabled={!partnerId}
        className="rounded-md bg-slate-700 px-3 py-1 text-sm text-zinc-950 hover:bg-slate-800 disabled:bg-slate-300"
      >
        + zuordnen
      </button>
    </div>
  );
}
