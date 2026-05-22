import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  type ColumnDef,
  type ColumnFiltersState,
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
  formatDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';

interface TicketsViewConfig {
  statusFilter: TicketStatusSlug[];
  prioFilter: TicketPrioritaetSlug[];
  sorting: SortingState;
  visibility: VisibilityState;
  columnFilters: ColumnFiltersState;
}

const DEFAULT_CONFIG: TicketsViewConfig = {
  statusFilter: ['neu', 'pruefung', 'bearbeitung', 'wartet'],
  prioFilter: [],
  sorting: [{ id: 'eroeffnet_am', desc: true }],
  visibility: { kategorie: false, objekt: false, partner: false },
  columnFilters: [],
};

const columns: ColumnDef<TicketRead>[] = [
  {
    id: 'nummer',
    accessorKey: 'nummer',
    header: 'Nr.',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-500">
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
        className="font-medium text-brand-700 hover:underline"
      >
        {row.original.titel}
      </Link>
    ),
  },
  {
    id: 'status',
    accessorFn: (r) => r.status.key,
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'prioritaet',
    accessorFn: (r) => r.prioritaet.key,
    header: 'Priorität',
    cell: ({ row }) => <PrioBadge prioritaet={row.original.prioritaet} />,
  },
  {
    id: 'kategorie',
    accessorFn: (r) => r.kategorie?.label ?? '',
    header: 'Kategorie',
    cell: ({ row }) => row.original.kategorie?.label ?? '—',
  },
  {
    id: 'objekt',
    accessorFn: (r) => r.objekt?.name ?? '',
    header: 'Objekt',
    cell: ({ row }) => row.original.objekt?.name ?? '—',
  },
  {
    id: 'partner',
    accessorFn: (r) => r.partner?.name ?? '',
    header: 'Partner',
    cell: ({ row }) => row.original.partner?.name ?? '—',
  },
  {
    id: 'zugewiesen_an',
    accessorFn: (r) => r.zugewiesen_an?.full_name ?? '',
    header: 'Zugewiesen an',
    cell: ({ row }) => row.original.zugewiesen_an?.full_name ?? '—',
  },
  {
    id: 'eroeffnet_am',
    accessorKey: 'eroeffnet_am',
    header: 'Eröffnet am',
    cell: ({ row }) => formatDateTime(row.original.eroeffnet_am),
  },
];

export function TicketsListePage() {
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<TicketsViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showErfassen, setShowErfassen] = useState(false);

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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-500">
            {ticketsQuery.data
              ? `${ticketsQuery.data.total} Tickets im System`
              : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowErfassen(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          Neues Ticket
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Status:
        </span>
        {STATUS_SLUGS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              config.statusFilter.includes(s)
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {labelForStatusSlug(s)}
          </button>
        ))}
        <span className="ml-3 text-xs font-semibold uppercase text-slate-500">
          Priorität:
        </span>
        {PRIO_SLUGS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePrio(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              config.prioFilter.includes(p)
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
        onSortingChange={(s) =>
          setConfig((prev) => ({ ...prev, sorting: s }))
        }
        columnFilters={config.columnFilters}
        onColumnFiltersChange={(f) =>
          setConfig((prev) => ({ ...prev, columnFilters: f }))
        }
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
