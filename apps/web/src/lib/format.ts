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

// Dark-theme Pill-Klassen (Mockup-Stil)
const statusBadgeClasses: Record<TicketStatusSlug, string> = {
  neu: 'bg-zinc-800 text-zinc-300',
  pruefung: 'bg-amber-500/15 text-amber-300',
  bearbeitung: 'bg-blue-500/15 text-blue-300',
  wartet: 'bg-orange-500/15 text-orange-300',
  erledigt: 'bg-emerald-500/15 text-emerald-300',
};

const statusDotClasses: Record<TicketStatusSlug, string> = {
  neu: 'bg-zinc-400',
  pruefung: 'bg-amber-400',
  bearbeitung: 'bg-blue-400',
  wartet: 'bg-orange-400',
  erledigt: 'bg-emerald-400',
};

const prioBadgeClasses: Record<TicketPrioritaetSlug, string> = {
  niedrig: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  mittel: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  hoch: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  kritisch: 'bg-red-500/20 text-red-300 border border-red-500/40',
};

// P1-P4-Code für die Mockup-Optik (kritisch=P1, hoch=P2, mittel=P3, niedrig=P4)
const prioCodeMap: Record<TicketPrioritaetSlug, string> = {
  kritisch: 'P1',
  hoch: 'P2',
  mittel: 'P3',
  niedrig: 'P4',
};

export function labelForStatusSlug(s: string): string {
  return statusLabels[s as TicketStatusSlug] ?? s;
}

export function labelForPrioSlug(p: string): string {
  return prioLabels[p as TicketPrioritaetSlug] ?? p;
}

export function prioCodeFor(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return prioCodeMap[key as TicketPrioritaetSlug] ?? '?';
}

export function classNamesForStatus(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return (
    statusBadgeClasses[key as TicketStatusSlug] ?? 'bg-zinc-800 text-zinc-300'
  );
}

export function classNamesForStatusDot(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return statusDotClasses[key as TicketStatusSlug] ?? 'bg-zinc-400';
}

export function classNamesForPrio(ref: AuswahlWertRef | string): string {
  const key = typeof ref === 'string' ? ref : ref.key;
  return (
    prioBadgeClasses[key as TicketPrioritaetSlug] ??
    'bg-zinc-800 text-zinc-300 border border-zinc-700'
  );
}

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const timeFmt = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

const dayMonthFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

/** Relative Anzeige im Mockup-Stil: „Heute, 14:22" / „Gestern, 09:10" / „04. Mai, 11:02". */
export function formatRelativeDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const time = timeFmt.format(d);
  if (d >= startOfToday) return `Heute, ${time}`;
  if (d >= startOfYesterday) return `Gestern, ${time}`;
  return `${dayMonthFmt.format(d)}, ${time}`;
}
