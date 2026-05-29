import clsx from 'clsx';
import { AlertCircle, Clock } from 'lucide-react';
import type { TicketRead } from '../api/types';
import { InitialAvatar } from './InitialAvatar';
import { PrioBadge, StatusBadge } from './StatusBadge';

interface TicketCardProps {
  ticket: TicketRead;
  /** Opens the ticket detail — same handler as the desktop row click. */
  onOpen: () => void;
  /** When set, the card is draggable (Kanban). Omitted = no drag (mobile pool list). */
  dragId?: string;
  /** Show the status badge — used in the pool where status isn't implied by a column. */
  showStatus?: boolean;
}

/**
 * Shared ticket card for the Kanban board and the mobile pool list.
 * Extracted from the former inline KanbanCard so both views stay in sync.
 */
export function TicketCard({ ticket, onOpen, dragId, showStatus }: TicketCardProps) {
  // Date-only comparison against today's LOCAL date (faelligkeit_am is a
  // 'YYYY-MM-DD' string). Avoids the UTC-midnight off-by-one a Date()<Date()
  // comparison has east of UTC: a ticket due today isn't overdue until tomorrow.
  const todayIso = new Date().toLocaleDateString('en-CA');
  const overdue =
    ticket.faelligkeit_am != null &&
    ticket.faelligkeit_am.slice(0, 10) < todayIso &&
    ticket.status.key !== 'erledigt';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Ticket #${ticket.nummer}: ${ticket.titel}, Priorität ${
        ticket.prioritaet.label
      }${showStatus ? `, Status ${ticket.status.label}` : ''}${
        overdue ? ', überfällig' : ''
      }`}
      draggable={!!dragId}
      onDragStart={
        dragId ? (e) => e.dataTransfer.setData('ticket-id', dragId) : undefined
      }
      className={clsx(
        'rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs hover:border-zinc-700',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        dragId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-zinc-500">#{ticket.nummer}</span>
        <PrioBadge prioritaet={ticket.prioritaet} />
      </div>
      <div className="text-sm font-medium text-zinc-100" title={ticket.titel}>
        <span className="line-clamp-2">{ticket.titel}</span>
      </div>
      {(showStatus || ticket.tickettyp) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {showStatus && <StatusBadge status={ticket.status} />}
          {ticket.tickettyp && (
            <span
              className={clsx(
                'inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
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
        </div>
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
          <AlertCircle className="h-2.5 w-2.5" aria-hidden /> überfällig
        </div>
      )}
      {ticket.faelligkeit_am && !overdue && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300">
          <Clock className="h-2.5 w-2.5" aria-hidden /> {ticket.faelligkeit_am}
        </div>
      )}
    </div>
  );
}
