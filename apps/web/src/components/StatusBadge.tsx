import type { AuswahlWertRef } from '../api/types';
import {
  classNamesForPrio,
  classNamesForStatus,
  classNamesForStatusDot,
  prioCodeFor,
} from '../lib/format';

export function StatusBadge({ status }: { status: AuswahlWertRef }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classNamesForStatus(status)}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${classNamesForStatusDot(status)}`}
      />
      {status.label}
    </span>
  );
}

/** Prio-Pill im Mockup-Stil: P1/P2/P3/P4-Code. */
export function PrioBadge({ prioritaet }: { prioritaet: AuswahlWertRef }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${classNamesForPrio(prioritaet)}`}
      title={prioritaet.label}
    >
      {prioCodeFor(prioritaet)}
    </span>
  );
}
