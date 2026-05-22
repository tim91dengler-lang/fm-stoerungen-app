import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ticketApi } from '../api/endpoints';
import type {
  TicketPrioritaetSlug,
  TicketRead,
  TicketStatusSlug,
} from '../api/types';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { TicketErfassenModal } from './TicketErfassenModal';
import {
  PRIO_SLUGS,
  STATUS_SLUGS,
  formatRelativeDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';
import { KpiCards, type KpiItem } from '../components/KpiCards';
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
}

const DEFAULT_CONFIG: TicketsViewConfig = {
  statusFilter: ['neu', 'pruefung', 'bearbeitung', 'wartet'],
  prioFilter: [],
  sorting: [{ id: 'eroeffnet_am', desc: true }],
  visibility: { kategorie: false, objekt: false, partner: false },
  columnFilters: [],
  columnOrder: [],
};

const STATUS_FILTER_OPTIONS: SelectOption[] = STATUS_SLUGS.map((s) => ({
  value: s,
  label: labelForStatusSlug(s),
}));
const PRIO_FILTER_OPTIONS: SelectOption[] = PRIO_SLUGS.map((p) => ({
  value: p,
  label: labelForPrioSlug(p),
}));

const columns: ColumnDef<TicketRead>[] = [
  {
    id: 'nummer',
    accessorKey: 'nummer',
    header: 'Nr.',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-zinc-500">
        #{row.original.nummer}
      </span>
    ),
  },
  {
    id: 'titel',
    accessorKey: 'titel',
    header: 'Titel',
    cell: ({ row }) => (
      <Link
        to={`/tickets/${row.original.id}`}
        className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
      >
        {row.original.titel}
      </Link>
    ),
    filterFn: 'includesString',
  },
  {
    id: 'status',
    accessorFn: (r) => r.status.key,
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: 'arrIncludesSome',
  },
  {
    id: 'prioritaet',
    accessorFn: (r) => r.prioritaet.key,
    header: 'Priorität',
    cell: ({ row }) => <PrioBadge prioritaet={row.original.prioritaet} />,
    filterFn: 'arrIncludesSome',
  },
  {
    id: 'kategorie',
    accessorFn: (r) => r.kategorie?.label ?? '',
    header: 'Kategorie',
    cell: ({ row }) => row.original.kategorie?.label ?? '—',
    filterFn: 'includesString',
  },
  {
    id: 'objekt',
    accessorFn: (r) => r.objekt?.name ?? '',
    header: 'Objekt',
    cell: ({ row }) => row.original.objekt?.name ?? '—',
    filterFn: 'includesString',
  },
  {
    id: 'partner',
    accessorFn: (r) => r.partner?.name ?? '',
    header: 'Partner',
    cell: ({ row }) => row.original.partner?.name ?? '—',
    filterFn: 'includesString',
  },
  {
    id: 'zugewiesen_an',
    accessorFn: (r) => r.zugewiesen_an?.full_name ?? '',
    header: 'Zugewiesen an',
    cell: ({ row }) => row.original.zugewiesen_an?.full_name ?? '—',
    filterFn: 'includesString',
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [searchParams, setSearchParams] = useSearchParams();

  const qc = useQueryClient();

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

  const bulkErledigt = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => ticketApi.update(id, { status: 'erledigt' })),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setRowSelection({});
    },
  });

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
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-zinc-100">Ticket-Pool</h1>
        <p className="text-sm text-zinc-500">
          {ticketsQuery.data
            ? `${ticketsQuery.data.items.length} von ${ticketsQuery.data.total} Tickets`
            : '—'}
        </p>
      </div>

      <KpiCards items={kpis} />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <span className="text-xs font-semibold uppercase text-zinc-500">
          Status:
        </span>
        {STATUS_SLUGS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              config.statusFilter.includes(s)
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {labelForStatusSlug(s)}
          </button>
        ))}
        <span className="ml-3 text-xs font-semibold uppercase text-zinc-500">
          Priorität:
        </span>
        {PRIO_SLUGS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePrio(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              config.prioFilter.includes(p)
                ? 'bg-orange-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {labelForPrioSlug(p)}
          </button>
        ))}
      </div>

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
        filterRenderers={filterRenderers}
        enableRowSelection
        getRowId={(t) => t.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        bulkActions={(selected) => (
          <>
            <button
              type="button"
              onClick={() => bulkErledigt.mutate(selected.map((t) => t.id))}
              disabled={bulkErledigt.isPending}
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              Auf „erledigt&quot; setzen
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(`${selected.length} Tickets wirklich löschen?`)
                ) {
                  bulkDelete.mutate(selected.map((t) => t.id));
                }
              }}
              disabled={bulkDelete.isPending}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/100/10 disabled:opacity-50"
            >
              Löschen
            </button>
          </>
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
    </div>
  );
}
