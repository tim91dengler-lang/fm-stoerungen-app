import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import clsx from 'clsx';
import { ticketApi } from '../api/endpoints';
import type { TicketRead, TicketStatusSlug } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { TicketCard } from '../components/TicketCard';
import { TicketDetailPanel } from '../components/TicketDetailPanel';
import { iconForKategorie } from '../lib/kategorieIcon';
import {
  PRIO_SLUGS,
  STATUS_SLUGS,
  formatRelativeDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';
import { DateFilter, dateLteFilter, selectFilter } from '../core/felder/listFields';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter, type SelectOption } from '../core/liste/columnFilters';

/**
 * „Meine Tickets" — die mir zugewiesenen Tickets als echte Standard-Liste
 * (`PowerListenView`): Spalten ein-/ausblendbar (Zahnrad), Spaltenfilter,
 * Multi-Sort, Gruppierung, gespeicherte Ansichten, mobile Karten. Erledigte sind
 * standardmäßig ausgeblendet (Status-Default-Filter) und per Schalter
 * „Erledigte einblenden" einblendbar (Tim 2026-06-03).
 */

const NON_ERLEDIGT: TicketStatusSlug[] = ['neu', 'pruefung', 'bearbeitung', 'wartet'];
const ALL_STATUS: TicketStatusSlug[] = [...NON_ERLEDIGT, 'erledigt'];

// Priorität sinnvoll sortieren (kritisch zuerst) statt alphabetisch nach Key.
const PRIO_RANK: Record<string, number> = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  columnOrder: string[];
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'prioritaet', desc: false }],
  // „Ort" + „Eröffnet" standardmäßig aus — über das Zahnrad einblendbar.
  visibility: { ort: false, eroeffnet_am: false },
  // Erledigte standardmäßig ausgeblendet (Default-Filter auf der Status-Spalte).
  columnFilters: [{ id: 'status', value: NON_ERLEDIGT }],
  columnOrder: [
    'nummer',
    'titel',
    'objekt',
    'ort',
    'prioritaet',
    'status',
    'faelligkeit_am',
    'eroeffnet_am',
  ],
  grouping: [],
};

const GROUPABLE_COLUMNS = [
  { id: 'status', label: 'nach Status' },
  { id: 'prioritaet', label: 'nach Priorität' },
  { id: 'objekt', label: 'nach Objekt' },
];

const STATUS_FILTER_OPTIONS: SelectOption[] = STATUS_SLUGS.map((s) => ({
  value: s,
  label: labelForStatusSlug(s),
}));
const PRIO_FILTER_OPTIONS: SelectOption[] = PRIO_SLUGS.map((p) => ({
  value: p,
  label: labelForPrioSlug(p),
}));

const filterRenderers = {
  titel: TextFilter,
  status: selectFilter(STATUS_FILTER_OPTIONS),
  prioritaet: selectFilter(PRIO_FILTER_OPTIONS),
  objekt: TextFilter,
  ort: TextFilter,
  faelligkeit_am: DateFilter,
};

function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
function ortLabel(t: TicketRead): string {
  return [t.haus?.bezeichnung, t.stockwerk?.bezeichnung, t.einheit?.bezeichnung]
    .filter(Boolean)
    .join(' · ');
}

function buildColumns(onOpen: (id: string) => void): ColumnDef<TicketRead>[] {
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
            className="flex max-w-[26rem] items-center gap-2 text-left"
          >
            <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="truncate font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
              {row.original.titel}
            </span>
          </button>
        );
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
          <div className="flex items-center gap-1.5 text-zinc-200">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">{o.name}</span>
          </div>
        );
      },
    },
    {
      id: 'ort',
      accessorFn: (r) => ortLabel(r),
      header: 'Ort',
      cell: ({ row }) => {
        const ort = ortLabel(row.original);
        return ort ? (
          <span className="truncate text-zinc-300">{ort}</span>
        ) : (
          <span className="text-zinc-600">—</span>
        );
      },
    },
    {
      id: 'prioritaet',
      accessorFn: (r) => r.prioritaet.key,
      header: 'Priorität',
      cell: ({ row }) => <PrioBadge prioritaet={row.original.prioritaet} />,
      filterFn: 'arrIncludesSome',
      sortingFn: (a, b) =>
        (PRIO_RANK[a.original.prioritaet.key] ?? 9) -
        (PRIO_RANK[b.original.prioritaet.key] ?? 9),
    },
    {
      id: 'status',
      accessorFn: (r) => r.status.key,
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={row.original.status} />
          {row.original.wartet_grund && (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              {row.original.wartet_grund.label}
            </span>
          )}
        </div>
      ),
      filterFn: 'arrIncludesSome',
    },
    {
      id: 'faelligkeit_am',
      accessorKey: 'faelligkeit_am',
      header: 'Fällig am',
      sortUndefined: 'last',
      filterFn: dateLteFilter,
      cell: ({ row }) => {
        const d = row.original.faelligkeit_am;
        if (!d) return <span className="text-zinc-600">—</span>;
        const heute = new Date().toISOString().slice(0, 10);
        const ueberfaellig = d < heute && row.original.status.key !== 'erledigt';
        return (
          <span className={ueberfaellig ? 'font-medium text-red-400' : 'text-zinc-300'}>
            {formatDateDE(d)}
          </span>
        );
      },
    },
    {
      id: 'eroeffnet_am',
      accessorKey: 'eroeffnet_am',
      header: 'Eröffnet',
      cell: ({ row }) => (
        <span className="text-xs text-zinc-400">
          {formatRelativeDateTime(row.original.eroeffnet_am)}
        </span>
      ),
    },
  ];
}

function statusFilterSlugs(
  columnFilters: ColumnFiltersState,
): TicketStatusSlug[] | undefined {
  const entry = columnFilters.find((f) => f.id === 'status');
  const v = entry?.value;
  return Array.isArray(v) && v.length > 0 ? (v as TicketStatusSlug[]) : undefined;
}

export function MeineTicketsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openTicketId = searchParams.get('ticket');

  function openTicket(id: string) {
    searchParams.set('ticket', id);
    setSearchParams(searchParams);
  }
  function closeTicket() {
    searchParams.delete('ticket');
    setSearchParams(searchParams);
  }

  const columns = useMemo(() => buildColumns(openTicket), []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusSlugs = statusFilterSlugs(config.columnFilters);
  const showErledigt = !!statusSlugs?.includes('erledigt');

  function toggleErledigt() {
    setConfig((prev) => ({
      ...prev,
      columnFilters: [
        ...prev.columnFilters.filter((f) => f.id !== 'status'),
        { id: 'status', value: showErledigt ? NON_ERLEDIGT : ALL_STATUS },
      ],
    }));
  }

  const filters = useMemo(
    () => ({
      zugewiesen_an_id: user?.id,
      status: statusSlugs,
      search: search.trim() || undefined,
      limit: 200,
    }),
    [user?.id, statusSlugs, search],
  );

  const ticketsQuery = useQuery({
    queryKey: ['meine-tickets', filters],
    queryFn: () =>
      user
        ? ticketApi.list(filters)
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    enabled: !!user,
  });

  return (
    <div className="space-y-4 px-3 py-5 sm:px-4 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Meine Tickets</h1>
        <p className="text-sm text-zinc-500">
          {ticketsQuery.data
            ? `${ticketsQuery.data.items.length} ${showErledigt ? '' : 'offene '}Tickets, ${user?.full_name ?? 'mir'} zugewiesen`
            : '—'}
        </p>
      </div>

      <PowerListenView<TicketRead>
        viewKey="meine-tickets"
        polish={{
          stickyHeader: true,
          stickyGroupHeaders: true,
          groupSeparators: true,
          densityToggle: true,
          consolidatedSettingsMenu: true,
          searchShortcut: true,
        }}
        columns={columns}
        data={ticketsQuery.data?.items ?? []}
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
        groupableColumns={GROUPABLE_COLUMNS}
        filterRenderers={filterRenderers}
        onRowClick={(row) => openTicket(row.id)}
        renderMobileCard={(t) => (
          <TicketCard ticket={t} showStatus onOpen={() => openTicket(t.id)} />
        )}
        count={
          ticketsQuery.data
            ? { filtered: ticketsQuery.data.items.length, total: ticketsQuery.data.total }
            : undefined
        }
        toolbarLeft={
          <SavedViewsMenu
            viewKey="meine-tickets"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        toolbarRight={
          <button
            type="button"
            onClick={toggleErledigt}
            className={clsx(
              'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
              showErledigt
                ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
            )}
            title={showErledigt ? 'Erledigte ausblenden' : 'Erledigte einblenden'}
          >
            {showErledigt ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Erledigte
          </button>
        }
        searchPlaceholder="In meinen Tickets suchen …"
        showFooter
        itemLabel={{ singular: 'Ticket', plural: 'Tickets' }}
      />

      <TicketDetailPanel ticketId={openTicketId} onClose={closeTicket} />
    </div>
  );
}
