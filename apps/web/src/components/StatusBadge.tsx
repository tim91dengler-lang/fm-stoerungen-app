import type { AuswahlWertRef } from '../api/types';
import { classNamesForPrio, classNamesForStatus } from '../lib/format';

export function StatusBadge({ status }: { status: AuswahlWertRef }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classNamesForStatus(status)}`}
    >
      {status.label}
    </span>
  );
}

export function PrioBadge({ prioritaet }: { prioritaet: AuswahlWertRef }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classNamesForPrio(prioritaet)}`}
    >
      {prioritaet.label}
    </span>
  );
}
