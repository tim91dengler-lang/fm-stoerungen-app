import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListIcon, Search } from 'lucide-react';
import clsx from 'clsx';
import { ticketApi } from '../api/endpoints';
import type { TicketStatusSlug } from '../api/types';
import { TicketCard } from '../components/TicketCard';
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
      [t.titel, t.beschreibung, t.objekt?.name ?? '', t.nummer.toString()]
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
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    dragId={t.id}
                    onOpen={() => openTicket(t.id)}
                  />
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
