import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Flame,
  LayoutGrid,
  MapPin,
} from 'lucide-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  auswahllistenApi,
  objektApi,
  partnerApi,
  ticketApi,
  userApi,
} from '../api/endpoints';
import type {
  TicketPrioritaetSlug,
  TicketRead,
  TicketStatusSlug,
} from '../api/types';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { usePartnerTypLookup } from '../lib/usePartnerTypLookup';
import { TicketErfassenModal } from './TicketErfassenModal';
import {
  PRIO_SLUGS,
  STATUS_SLUGS,
  formatRelativeDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';
import { KpiCards, type KpiItem } from '../components/KpiCards';
import { TicketDetailPanel } from '../components/TicketDetailPanel';
import { InitialAvatar } from '../components/InitialAvatar';
import { iconForKategorie } from '../lib/kategorieIcon';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import {
  SelectFilter,
  TextFilter,
  type SelectOption,
} from '../core/liste/columnFilters';

interface TicketsViewConfig {
  statusFilter: TicketStatusSlug[];
  prioFilter: TicketPrioritaetSlug[];
  sorting: SortingState;
  visibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  columnOrder: string[];
  grouping: GroupingState;
}

const DEFAULT_CONFIG: TicketsViewConfig = {
  statusFilter: ['neu', 'pruefung', 'bearbeitung', 'wartet'],
  prioFilter: [],
  sorting: [{ id: 'eroeffnet_am', desc: true }],
  // Mockup-Layout: Nr., Titel (mit Kategorie-Icon), Objekt, Partner, Prio, Status,
  // Bearbeiter, Erstellt. Kategorie ist als eigene Spalte default ausgeblendet,
  // weil sie als Icon vor dem Titel sichtbar ist.
  visibility: { kategorie: false },
  columnFilters: [],
  columnOrder: [
    'nummer',
    'titel',
    'objekt',
    'partner',
    'prioritaet',
    'status',
    'zugewiesen_an',
    'eroeffnet_am',
  ],
  grouping: [],
};

const GROUPABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'status', label: 'nach Status' },
  { id: 'prioritaet', label: 'nach Priorität' },
  { id: 'kategorie', label: 'nach Kategorie' },
  { id: 'objekt', label: 'nach Objekt' },
  { id: 'partner', label: 'nach Geschäftspartner' },
  { id: 'zugewiesen_an', label: 'nach Bearbeiter' },
];

// Slug-basierter Fallback für Tone — kommt zum Tragen, wenn die Auswahlliste
// keine Farbe gesetzt hat. Reihenfolge: w.farbe → SLUG-Tabelle → neutral.
const PARTNER_TYP_TONE_BY_SLUG: Record<string, string> = {
  mieter: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  eigentuemer: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  auftraggeber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  dienstleister: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  nachunternehmer: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  privatperson: 'bg-zinc-700/40 text-zinc-300 border-zinc-700',
};
const PARTNER_TYP_TONE_NEUTRAL = 'bg-zinc-700/40 text-zinc-300 border-zinc-700';

function toneForSlug(slug: string | null): string {
  if (!slug) return PARTNER_TYP_TONE_NEUTRAL;
  return PARTNER_TYP_TONE_BY_SLUG[slug] ?? PARTNER_TYP_TONE_NEUTRAL;
}

function PartnerTypPill({
  typId,
  lookup,
}: {
  typId: string;
  lookup: ReturnType<typeof usePartnerTypLookup>;
}) {
  const label = lookup.labelFor(typId) || '—';
  const tone = toneForSlug(lookup.slugFor(typId));
  return (
    <span
      className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

const STATUS_FILTER_OPTIONS: SelectOption[] = STATUS_SLUGS.map((s) => ({
  value: s,
  label: labelForStatusSlug(s),
}));
const PRIO_FILTER_OPTIONS: SelectOption[] = PRIO_SLUGS.map((p) => ({
  value: p,
  label: labelForPrioSlug(p),
}));

interface MassEditOptions {
  status: SelectOption[];
  prioritaet: SelectOption[];
  kategorie: SelectOption[];
  objekt: SelectOption[];
  partner: SelectOption[];
  zugewiesen_an: SelectOption[];
  projekt: SelectOption[];
}

function buildColumns(
  onOpen: (ticketId: string) => void,
  massEditOptions: MassEditOptions,
  partnerTypLookup: ReturnType<typeof usePartnerTypLookup>,
): ColumnDef<TicketRead>[] {
  return [
    {
      id: 'nummer',
      accessorKey: 'nummer',
      header: 'Nr.',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onOpen(row.original.id)}
          className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
        >
          #{row.original.nummer}
        </button>
      ),
    },
    {
      id: 'titel',
      accessorKey: 'titel',
      header: 'Titel',
      cell: ({ row }) => {
        const Icon = iconForKategorie(row.original.kategorie?.key);
        return (
          <button
            type="button"
            onClick={() => onOpen(row.original.id)}
            className="flex max-w-[20rem] items-center gap-2 text-left"
          >
            <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="truncate font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
              {row.original.titel}
            </span>
          </button>
        );
      },
      // filterFn weggelassen → comboboxFilterFn (Pills + Suche)
    },
    {
      id: 'status',
      accessorFn: (r) => r.status.key,
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: 'arrIncludesSome',
      meta: {
        massEdit: { type: 'auswahl' as const, options: massEditOptions.status },
      },
    },
    {
      id: 'prioritaet',
      accessorFn: (r) => r.prioritaet.key,
      header: 'Priorität',
      cell: ({ row }) => <PrioBadge prioritaet={row.original.prioritaet} />,
      filterFn: 'arrIncludesSome',
      meta: {
        massEdit: {
          type: 'auswahl' as const,
          options: massEditOptions.prioritaet,
        },
      },
    },
    {
      id: 'kategorie',
      accessorFn: (r) => r.kategorie?.label ?? '',
      header: 'Kategorie',
      cell: ({ row }) => row.original.kategorie?.label ?? '—',
      // filterFn weggelassen → comboboxFilterFn (Pills + Suche)
      meta: {
        massEdit: {
          type: 'auswahl' as const,
          options: massEditOptions.kategorie,
        },
      },
    },
    {
      id: 'objekt',
      accessorFn: (r) => r.objekt?.name ?? '',
      header: 'Objekt',
      cell: ({ row }) => {
        const o = row.original.objekt;
        if (!o) return <span className="text-zinc-600">—</span>;
        return (
          <div className="flex items-center gap-2 text-zinc-200">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">{o.name}</span>
          </div>
        );
      },
      // filterFn weggelassen → nutzt comboboxFilterFn (Pills + Suche) aus defaultColumn
      meta: {
        massEdit: {
          type: 'combobox' as const,
          options: massEditOptions.objekt,
        },
      },
    },
    {
      id: 'partner',
      accessorFn: (r) => r.partner?.name ?? '',
      header: 'Geschäftspartner',
      cell: ({ row }) => {
        const p = row.original.partner;
        if (!p) return <span className="text-zinc-600">—</span>;
        const firstTyp = p.typen[0];
        return (
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-zinc-200">{p.name}</span>
            {firstTyp && (
              <PartnerTypPill typId={firstTyp} lookup={partnerTypLookup} />
            )}
          </div>
        );
      },
      // filterFn weggelassen → comboboxFilterFn aus defaultColumn (Pills + Suche)
      meta: {
        massEdit: {
          type: 'combobox' as const,
          options: massEditOptions.partner,
        },
      },
    },
    {
      id: 'zugewiesen_an',
      accessorFn: (r) => r.zugewiesen_an?.full_name ?? '',
      header: 'Bearbeiter',
      cell: ({ row }) => {
        const u = row.original.zugewiesen_an;
        if (!u)
          return (
            <span className="font-medium text-amber-400/90">
              Nicht zugewiesen
            </span>
          );
        return (
          <div className="flex items-center gap-2">
            <InitialAvatar fullName={u.full_name} size="sm" />
            <span className="text-zinc-200">{u.full_name}</span>
          </div>
        );
      },
      // filterFn weggelassen → comboboxFilterFn aus defaultColumn
      meta: {
        massEdit: {
          type: 'combobox' as const,
          options: massEditOptions.zugewiesen_an,
        },
      },
    },
    {
      id: 'eroeffnet_am',
      accessorKey: 'eroeffnet_am',
      header: 'Eröffnet am',
      cell: ({ row }) => (
        <span className="text-zinc-400">
          {formatRelativeDateTime(row.original.eroeffnet_am)}
        </span>
      ),
    },
  ];
}

const filterRenderers = {
  titel: TextFilter,
  status: (props: { value: unknown; onChange: (v: unknown) => void }) => (
    <SelectFilter {...props} options={STATUS_FILTER_OPTIONS} />
  ),
  prioritaet: (props: { value: unknown; onChange: (v: unknown) => void }) => (
    <SelectFilter {...props} options={PRIO_FILTER_OPTIONS} />
  ),
  kategorie: TextFilter,
  objekt: TextFilter,
  partner: TextFilter,
  zugewiesen_an: TextFilter,
};

export function TicketsListePage() {
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<TicketsViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showErfassen, setShowErfassen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<TicketRead[] | null>(
    null,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const openTicketId = searchParams.get('ticket');

  // Filter-Panel beim Außerhalb-Klick schließen
  useEffect(() => {
    if (!showFilterPanel) return;
    function handler(e: MouseEvent) {
      if (!filterPanelRef.current?.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterPanel]);

  function openTicket(id: string) {
    searchParams.set('ticket', id);
    setSearchParams(searchParams);
  }
  function closeTicket() {
    searchParams.delete('ticket');
    setSearchParams(searchParams);
  }

  const qc = useQueryClient();

  // Reference-Data-Queries für Mass-Edit-Combobox-Optionen.
  // Werden nur 1x geladen + gecacht (staleTime 60s) — keine
  // Performance-Belastung wenn der User Mass-Edit gar nicht nutzt.
  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });
  const objekteQuery = useQuery({
    queryKey: ['objekte-for-mass-edit'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
  });
  const partnerQuery = useQuery({
    queryKey: ['partner-for-mass-edit'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });
  const usersQuery = useQuery({
    queryKey: ['users-for-mass-edit'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const massEditOptions = useMemo<MassEditOptions>(() => {
    const statusListe = auswahllistenQuery.data?.find(
      (l) => l.key === 'ticket_status',
    );
    const prioListe = auswahllistenQuery.data?.find(
      (l) => l.key === 'ticket_prioritaet',
    );
    const kategorieListe = auswahllistenQuery.data?.find(
      (l) => l.key === 'ticket_kategorie',
    );
    return {
      status: (statusListe?.werte ?? [])
        .filter((w) => w.ist_aktiv)
        .map((w) => ({ value: w.key, label: w.label })),
      prioritaet: (prioListe?.werte ?? [])
        .filter((w) => w.ist_aktiv)
        .map((w) => ({ value: w.key, label: w.label })),
      kategorie: (kategorieListe?.werte ?? [])
        .filter((w) => w.ist_aktiv)
        .map((w) => ({ value: w.key, label: w.label })),
      objekt: (objekteQuery.data?.items ?? []).map((o) => ({
        value: o.id,
        label: o.name,
      })),
      partner: (partnerQuery.data?.items ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
      zugewiesen_an: (usersQuery.data?.items ?? []).map((u) => ({
        value: u.id,
        label: u.full_name,
      })),
      projekt: [], // belegt sobald Projekt-Spalte ergänzt wird
    };
  }, [
    auswahllistenQuery.data,
    objekteQuery.data,
    partnerQuery.data,
    usersQuery.data,
  ]);

  const partnerTypLookup = usePartnerTypLookup();
  const columns = useMemo(
    () => buildColumns(openTicket, massEditOptions, partnerTypLookup),
    [massEditOptions, partnerTypLookup], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Inline-Mass-Edit-Handler. Mapped die Combobox-/Auswahl-Werte auf den
  // korrekten Backend-Payload (Slugs für ticket_*-Spalten, UUIDs für FK-Spalten).
  async function handleMassEdit(
    columnId: string,
    value: unknown,
    rows: TicketRead[],
  ): Promise<{ ok: number; failed: number }> {
    const fieldMap: Record<string, string> = {
      status: 'status',
      prioritaet: 'prioritaet',
      kategorie: 'kategorie',
      objekt: 'objekt_id',
      partner: 'partner_id',
      zugewiesen_an: 'zugewiesen_an_id',
    };
    const field = fieldMap[columnId] ?? columnId;
    const payload = { [field]: value };
    const results = await Promise.allSettled(
      rows.map((r) => ticketApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['tickets-kpi'] });
    return { ok, failed: results.length - ok };
  }

  // Sidebar-Button „+ Neues Ticket" navigiert auf /tickets?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowErfassen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: config.statusFilter.length > 0 ? config.statusFilter : undefined,
      prioritaet: config.prioFilter.length > 0 ? config.prioFilter : undefined,
      limit: 200,
    }),
    [search, config.statusFilter, config.prioFilter],
  );

  const ticketsQuery = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketApi.list(filters),
  });

  // Separate Abfrage für KPI-Zahlen (alle Tickets, unabhängig von Filter)
  const kpiQuery = useQuery({
    queryKey: ['tickets-kpi'],
    queryFn: () => ticketApi.list({ limit: 500 }),
    staleTime: 30_000,
  });

  const kpis: KpiItem[] = useMemo(() => {
    const all = kpiQuery.data?.items ?? [];
    const offen = all.filter((t) => t.status.key !== 'erledigt').length;
    const neu = all.filter(
      (t) => t.status.key === 'neu' && !t.zugewiesen_an,
    ).length;
    const kritisch = all.filter(
      (t) => t.prioritaet.key === 'kritisch' && t.status.key !== 'erledigt',
    ).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const heuteErledigt = all.filter(
      (t) =>
        t.erledigt_am !== null && new Date(t.erledigt_am) >= startOfToday,
    ).length;
    return [
      {
        label: 'Offen',
        wert: offen,
        sub: 'alle Status außer erledigt',
        icon: Activity,
        accent: 'emerald',
      },
      {
        label: 'Neu',
        wert: neu,
        sub: 'noch nicht zugewiesen',
        icon: AlertTriangle,
        accent: 'amber',
      },
      {
        label: 'Kritisch',
        wert: kritisch,
        sub: 'Priorität P1',
        icon: Flame,
        accent: 'red',
      },
      {
        label: 'Heute erledigt',
        wert: heuteErledigt,
        sub: 'Tagesleistung',
        icon: CheckCircle2,
        accent: 'zinc',
      },
    ];
  }, [kpiQuery.data]);

  // bulkErledigt entfernt (R5a, Tim 2026-05-25): die Funktion ist redundant zu
  // Inline-Mass-Edit auf der Status-Spalte. User können dort jeden Status
  // setzen, nicht nur 'erledigt' — ein dedizierter Bulk-Button ist überflüssig.

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => ticketApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setRowSelection({});
    },
  });

  function toggleStatus(s: TicketStatusSlug) {
    setConfig((prev) => ({
      ...prev,
      statusFilter: prev.statusFilter.includes(s)
        ? prev.statusFilter.filter((x) => x !== s)
        : [...prev.statusFilter, s],
    }));
  }
  function togglePrio(p: TicketPrioritaetSlug) {
    setConfig((prev) => ({
      ...prev,
      prioFilter: prev.prioFilter.includes(p)
        ? prev.prioFilter.filter((x) => x !== p)
        : [...prev.prioFilter, p],
    }));
  }

  function applySavedConfig(rawConfig: Record<string, unknown>) {
    setConfig({ ...DEFAULT_CONFIG, ...(rawConfig as Partial<TicketsViewConfig>) });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Ticket-Pool</h1>
          <p className="text-sm text-zinc-500">
            {ticketsQuery.data
              ? `${ticketsQuery.data.items.length} von ${ticketsQuery.data.total} Tickets`
              : '—'}
          </p>
        </div>
        <Link
          to="/kanban"
          className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          title="Kanban-Ansicht"
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Kanban
        </Link>
      </div>

      <KpiCards items={kpis} />

      <PowerListenView<TicketRead>
        viewKey="tickets"
        columns={columns}
        data={ticketsQuery.data?.items ?? []}
        search={search}
        onSearchChange={setSearch}
        visibility={config.visibility}
        onVisibilityChange={(v) =>
          setConfig((prev) => ({ ...prev, visibility: v }))
        }
        sorting={config.sorting}
        onSortingChange={(s) => setConfig((prev) => ({ ...prev, sorting: s }))}
        columnFilters={config.columnFilters}
        onColumnFiltersChange={(f) =>
          setConfig((prev) => ({ ...prev, columnFilters: f }))
        }
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) =>
          setConfig((prev) => ({ ...prev, columnOrder: o }))
        }
        grouping={config.grouping}
        onGroupingChange={(g) =>
          setConfig((prev) => ({ ...prev, grouping: g }))
        }
        groupableColumns={GROUPABLE_COLUMNS}
        filterRenderers={filterRenderers}
        enableRowSelection
        getRowId={(t) => t.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onMassEdit={handleMassEdit}
        rowActions={{
          onEdit: (row) => openTicket(row.id),
          onDelete: (rows) => setBulkDeleteConfirm(rows),
        }}
        bulkActions={(selected) => (
          <button
            type="button"
            onClick={() => setBulkDeleteConfirm(selected)}
            disabled={bulkDelete.isPending}
            className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Löschen ({selected.length})
          </button>
        )}
        count={
          ticketsQuery.data
            ? {
                filtered: ticketsQuery.data.items.length,
                total: ticketsQuery.data.total,
              }
            : undefined
        }
        toolbarLeft={
          <SavedViewsMenu
            viewKey="tickets"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              applySavedConfig(c);
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in allen Feldern …"
        showFooter
        itemLabel={{ singular: 'Ticket', plural: 'Tickets' }}
        filterButton={
          <div className="relative" ref={filterPanelRef}>
            <button
              type="button"
              onClick={() => setShowFilterPanel((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                config.statusFilter.length > 0 || config.prioFilter.length > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {(config.statusFilter.length > 0 ||
                config.prioFilter.length > 0) && (
                <span className="rounded bg-emerald-500/30 px-1 font-mono text-[10px]">
                  {config.statusFilter.length + config.prioFilter.length}
                </span>
              )}
            </button>
            {showFilterPanel && (
              <div className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_SLUGS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStatus(s)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          config.statusFilter.includes(s)
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {labelForStatusSlug(s)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Priorität
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PRIO_SLUGS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePrio(p)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          config.prioFilter.includes(p)
                            ? 'bg-orange-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {labelForPrioSlug(p)}
                      </button>
                    ))}
                  </div>
                </div>
                {(config.statusFilter.length > 0 ||
                  config.prioFilter.length > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        statusFilter: [],
                        prioFilter: [],
                      }))
                    }
                    className="mt-3 w-full rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            )}
          </div>
        }
      />

      {showErfassen && (
        <TicketErfassenModal
          onClose={() => setShowErfassen(false)}
          onCreated={() => {
            setShowErfassen(false);
            void ticketsQuery.refetch();
          }}
        />
      )}

      <TicketDetailPanel ticketId={openTicketId} onClose={closeTicket} />

      <ConfirmDialog
        open={bulkDeleteConfirm !== null}
        title={
          bulkDeleteConfirm && bulkDeleteConfirm.length === 1
            ? 'Ticket löschen?'
            : `${bulkDeleteConfirm?.length ?? 0} Tickets löschen?`
        }
        message={
          bulkDeleteConfirm && bulkDeleteConfirm.length === 1
            ? `Ticket #${bulkDeleteConfirm[0]?.nummer} „${bulkDeleteConfirm[0]?.titel}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
            : `${bulkDeleteConfirm?.length ?? 0} ausgewählte Tickets werden unwiderruflich gelöscht.`
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={bulkDelete.isPending}
        onConfirm={() => {
          if (!bulkDeleteConfirm) return;
          bulkDelete.mutate(bulkDeleteConfirm.map((t) => t.id), {
            onSuccess: () => setBulkDeleteConfirm(null),
          });
        }}
        onCancel={() => setBulkDeleteConfirm(null)}
      />
    </div>
  );
}
