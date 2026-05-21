import type { TicketPrioritaet, TicketStatus } from '../api/types';

const statusLabels: Record<TicketStatus, string> = {
  neu: 'Neu',
  zugewiesen: 'Zugewiesen',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
  geschlossen: 'Geschlossen',
};

const prioLabels: Record<TicketPrioritaet, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
};

export function labelForStatus(s: TicketStatus): string {
  return statusLabels[s];
}

export function labelForPrioritaet(p: TicketPrioritaet): string {
  return prioLabels[p];
}

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

export function classNamesForStatus(s: TicketStatus): string {
  switch (s) {
    case 'neu':
      return 'bg-slate-100 text-slate-700';
    case 'zugewiesen':
      return 'bg-blue-100 text-blue-700';
    case 'in_arbeit':
      return 'bg-amber-100 text-amber-800';
    case 'erledigt':
      return 'bg-emerald-100 text-emerald-700';
    case 'geschlossen':
      return 'bg-slate-200 text-slate-600';
  }
}

export function classNamesForPrio(p: TicketPrioritaet): string {
  switch (p) {
    case 'niedrig':
      return 'bg-slate-100 text-slate-600';
    case 'mittel':
      return 'bg-blue-100 text-blue-700';
    case 'hoch':
      return 'bg-orange-100 text-orange-700';
    case 'kritisch':
      return 'bg-red-100 text-red-700';
  }
}
