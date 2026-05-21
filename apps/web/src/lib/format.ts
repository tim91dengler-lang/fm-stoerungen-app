import type {
  AuswahlWertRef,
  TicketPrioritaetSlug,
  TicketStatusSlug,
} from '../api/types';

export const STATUS_SLUGS: TicketStatusSlug[] = [
  'neu',
  'pruefung',
  'bearbeitung',
  'wartet',
  'erledigt',
];

export const PRIO_SLUGS: TicketPrioritaetSlug[] = [
  'niedrig',
  'mittel',
  'hoch',
  'kritisch',
];

const statusLabels: Record<TicketStatusSlug, string> = {
  neu: 'Neu',
  pruefung: 'In Prüfung',
  bearbeitung: 'In Bearbeitung',
  wartet: 'Wartet',
  erledigt: 'Erledigt',
};

const prioLabels: Record<TicketPrioritaetSlug, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
};

const statusFarben: Record<TicketStatusSlug, string> = {
  neu: 'bg-slate-100 text-slate-700',
  pruefung: 'bg-amber-100 text-amber-800',
  bearbeitung: 'bg-blue-100 text-blue-700',
  wartet: 'bg-orange-100 text-orange-700',
  erledigt: 'bg-emerald-100 text-emerald-700',
};

const prioFarben: Record<TicketPrioritaetSlug, string> = {
  niedrig: 'bg-slate-100 text-slate-600',
  mittel: 'bg-blue-100 text-blue-700',
  hoch: 'bg-orange-100 text-orange-700',
  kritisch: 'bg-red-100 text-red-700',
};

export function labelForStatusSlug(s: string): string {
  return statusLabels[s as TicketStatusSlug] ?? s;
}

export function labelForPrioSlug(p: string): string {
  return prioLabels[p as TicketPrioritaetSlug] ?? p;
}

export function classNamesForStatus(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return statusFarben[key as TicketStatusSlug] ?? 'bg-slate-100 text-slate-700';
}

export function classNamesForPrio(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return prioFarben[key as TicketPrioritaetSlug] ?? 'bg-slate-100 text-slate-600';
}

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}
