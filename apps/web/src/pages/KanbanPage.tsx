import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  ListIcon,
  Search,
} from 'lucide-react';
import clsx from 'clsx';
import { ticketApi } from '../api/endpoints';
import type {
  TicketRead,
  TicketStatusSlug,
} from '../api/types';
import { InitialAvatar } from '../components/InitialAvatar';
import { PrioBadge } from '../components/StatusBadge';
import { TicketDetailPanel } from '../components/TicketDetailPanel';

const COLUMNS: { status: TicketStatusSlug; label: string; color: string }[] = [
  { status: 'neu', label: 'Neu', color: 'border-sky-500/40' },
  { status: 'pruefung', label: 'Prüfung', color: 'border-violet-500/40' },
  { status: 'bearbeitung', label: 'In Bearbeitung', color: 'border-emerald-500/40' },
  { status: 'wartet', label: 'Wartet', color: 'border-amber-500/40' },
  { status: 'erledigt', label: 'Erledigt', color: 'border-zinc-700' },
];

export function KanbanPage() {
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const openTicketId = searchParams.get('ticket');
  const qc = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ['tickets-kanban'],
    queryFn: () => ticketApi.list({ limit: 500 }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatusSlug }) =>
      ticketApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets-kanban'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-kpi'] });
    },
  });

  const filtered = useMemo(() => {
    const items = ticketsQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((t) =>
      [t.titel, t.beschreibung, t.objekt?.name ?? '', t.melder ?? '', t.nummer.toString()]
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [ticketsQuery.data, search]);

  function byStatus(s: TicketStatusSlug) {
    return filtered.filter((t) => t.status.key === s);
  }

  function openTicket(id: string) {
    searchParams.set('ticket', id);
    setSearchParams(searchParams);
  }
  function closeTicket() {
    searchParams.delete('ticket');
    setSearchParams(searchParams);
  }

  function onDrop(e: React.DragEvent, status: TicketStatusSlug) {
    e.preventDefault();
    const id = e.dataTransfer.getData('ticket-id');
    if (id) updateStatus.mutate({ id, status });
  }

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Kanban-Board</h1>
          <p className="text-sm text-zinc-500">
            Tickets per Drag-&-Drop zwischen Status verschieben
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/tickets"
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <ListIcon className="h-3.5 w-3.5" /> Liste
          </Link>
        </div>
      </div>

      {/* Suche */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-zinc-500">{filtered.length} Tickets</div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = byStatus(col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, col.status)}
              className={clsx(
                'flex flex-col rounded-lg border bg-zinc-900/30 p-2',
                col.color,
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-zinc-200">{col.label}</span>
                <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] font-mono text-zinc-400">
                  {cards.length}
                </span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {cards.map((t) => (
                  <KanbanCard key={t.id} ticket={t} onOpen={() => openTicket(t.id)} />
                ))}
                {cards.length === 0 && (
                  <div className="rounded-md border border-dashed border-zinc-800 py-6 text-center text-xs text-zinc-600">
                    Keine Tickets
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TicketDetailPanel ticketId={openTicketId} onClose={closeTicket} />
    </div>
  );
}

function KanbanCard({ ticket, onOpen }: { ticket: TicketRead; onOpen: () => void }) {
  const overdue =
    ticket.faelligkeit_am &&
    new Date(ticket.faelligkeit_am) < new Date() &&
    ticket.status.key !== 'erledigt';
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('ticket-id', ticket.id)}
      onClick={onOpen}
      role="button"
      className="cursor-grab rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs hover:border-zinc-700 active:cursor-grabbing"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-zinc-500">#{ticket.nummer}</span>
        <PrioBadge prioritaet={ticket.prioritaet} />
      </div>
      <div className="text-sm font-medium text-zinc-100" title={ticket.titel}>
        <span className="line-clamp-2">{ticket.titel}</span>
      </div>
      {ticket.tickettyp && (
        <span
          className={clsx(
            'mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
            ticket.tickettyp.farbe === 'emerald'
              ? 'bg-emerald-500/10 text-emerald-300'
              : ticket.tickettyp.farbe === 'blue'
                ? 'bg-sky-500/10 text-sky-300'
                : 'bg-amber-500/10 text-amber-300',
          )}
        >
          {ticket.tickettyp.label}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between gap-1 text-[10px] text-zinc-500">
        <span className="truncate">
          {ticket.objekt?.name ?? '—'}
          {ticket.haus && ` · ${ticket.haus.bezeichnung}`}
        </span>
        {ticket.zugewiesen_an ? (
          <InitialAvatar fullName={ticket.zugewiesen_an.full_name} size="xs" />
        ) : (
          <span className="text-zinc-600">offen</span>
        )}
      </div>
      {overdue && (
        <div className="mt-1 flex items-center gap-1 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-300">
          <AlertCircle className="h-2.5 w-2.5" /> überfällig
        </div>
      )}
      {ticket.faelligkeit_am && !overdue && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300">
          <Clock className="h-2.5 w-2.5" /> {ticket.faelligkeit_am}
        </div>
      )}
    </div>
  );
}
