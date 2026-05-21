import { classNamesForPrio, classNamesForStatus, labelForPrioritaet, labelForStatus } from '../lib/format';
import type { TicketPrioritaet, TicketStatus } from '../api/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classNamesForStatus(status)}`}
    >
      {labelForStatus(status)}
    </span>
  );
}

export function PrioBadge({ prioritaet }: { prioritaet: TicketPrioritaet }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classNamesForPrio(prioritaet)}`}
    >
      {labelForPrioritaet(prioritaet)}
    </span>
  );
}
