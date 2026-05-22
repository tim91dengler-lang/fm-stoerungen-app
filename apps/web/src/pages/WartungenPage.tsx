import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import { ticketApi } from '../api/endpoints';
import type { TicketRead } from '../api/types';
import { TicketDetailPanel } from '../components/TicketDetailPanel';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function firstOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function lastOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function buildCalendarGrid(year: number, month: number): Date[] {
  const first = firstOfMonth(year, month);
  const last = lastOfMonth(year, month);
  const firstWeekdayMonBased = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekdayMonBased);
  const days: Date[] = [];
  const total = Math.ceil((firstWeekdayMonBased + last.getDate()) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function WartungenPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [searchParams, setSearchParams] = useSearchParams();
  const openTicketId = searchParams.get('ticket');

  const wartungQuery = useQuery({
    queryKey: ['wartungen-all'],
    queryFn: () => ticketApi.list({ limit: 500 }),
  });

  const wartungen = useMemo(() => {
    return (wartungQuery.data?.items ?? []).filter(
      (t) =>
        (t.tickettyp?.key === 'wartung' || t.tickettyp?.key === 'baubegehung') &&
        t.faelligkeit_am !== null,
    );
  }, [wartungQuery.data]);

  const byDay = useMemo(() => {
    const m = new Map<string, TicketRead[]>();
    for (const t of wartungen) {
      if (!t.faelligkeit_am) continue;
      const key = t.faelligkeit_am;
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [wartungen]);

  const days = buildCalendarGrid(year, month);
  const monthLabel = new Date(year, month).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  function move(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function jumpToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function openTicket(id: string) {
    searchParams.set('ticket', id);
    setSearchParams(searchParams);
  }
  function closeTicket() {
    searchParams.delete('ticket');
    setSearchParams(searchParams);
  }

  const todayIso = toIsoDate(today);

  const upcoming = useMemo(() => {
    const next30 = new Date();
    next30.setDate(next30.getDate() + 30);
    const next30Iso = toIsoDate(next30);
    return wartungen
      .filter((t) => t.faelligkeit_am! >= todayIso && t.faelligkeit_am! <= next30Iso)
      .sort((a, b) => a.faelligkeit_am!.localeCompare(b.faelligkeit_am!));
  }, [wartungen, todayIso]);

  const overdue = useMemo(() => {
    return wartungen
      .filter((t) => t.faelligkeit_am! < todayIso && t.status.key !== 'erledigt')
      .sort((a, b) => a.faelligkeit_am!.localeCompare(b.faelligkeit_am!));
  }, [wartungen, todayIso]);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Wrench className="h-5 w-5 text-emerald-400" /> Wartungen & Begehungen
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Termingebundene Tickets mit Fälligkeit — Kalender-Ansicht
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Diesen Monat"
          value={wartungen.filter((t) => t.faelligkeit_am!.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length}
          icon={Calendar}
          color="text-sky-300"
        />
        <StatCard label="Überfällig" value={overdue.length} icon={AlertCircle} color="text-red-300" />
        <StatCard label="Nächste 30 Tage" value={upcoming.length} icon={Wrench} color="text-emerald-300" />
      </div>

      {/* Kalender-Navigation */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Nächster Monat"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={jumpToday}
            className="ml-2 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Heute
          </button>
        </div>
        <div className="text-sm font-semibold text-zinc-100">{monthLabel}</div>
        <div className="text-xs text-zinc-500">{wartungen.length} insgesamt</div>
      </div>

      {/* Kalender-Grid */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/60 text-center">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = toIsoDate(d);
            const tickets = byDay.get(iso) ?? [];
            const inMonth = d.getMonth() === month;
            const isToday = iso === todayIso;
            return (
              <div
                key={iso}
                className={clsx(
                  'min-h-[88px] border-b border-r border-zinc-800/60 p-1.5',
                  !inMonth && 'bg-zinc-950/40 opacity-50',
                  isToday && 'ring-1 ring-emerald-500/40 ring-inset',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={clsx(
                      'text-xs font-medium',
                      isToday ? 'text-emerald-400' : 'text-zinc-400',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {tickets.length > 0 && (
                    <span className="rounded-full bg-zinc-800 px-1 text-[10px] font-mono text-zinc-400">
                      {tickets.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {tickets.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTicket(t.id)}
                      className={clsx(
                        'block w-full truncate rounded px-1 py-0.5 text-left text-[10px]',
                        t.tickettyp?.key === 'wartung'
                          ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                          : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
                      )}
                      title={t.titel}
                    >
                      <span className="font-mono opacity-60">#{t.nummer}</span> {t.titel}
                    </button>
                  ))}
                  {tickets.length > 3 && (
                    <div className="text-[9px] text-zinc-500">+{tickets.length - 3} weitere</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Listen unten: Überfällig + Nächste 30 Tage */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ListBox
          title="Überfällig"
          emptyLabel="Keine überfälligen Wartungen"
          tickets={overdue}
          onOpenTicket={openTicket}
          accent="red"
        />
        <ListBox
          title="Nächste 30 Tage"
          emptyLabel="Keine geplanten Wartungen"
          tickets={upcoming}
          onOpenTicket={openTicket}
          accent="emerald"
        />
      </div>

      <TicketDetailPanel ticketId={openTicketId} onClose={closeTicket} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Calendar;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
        </div>
        <Icon className={clsx('h-6 w-6', color)} />
      </div>
    </div>
  );
}

function ListBox({
  title,
  emptyLabel,
  tickets,
  onOpenTicket,
  accent,
}: {
  title: string;
  emptyLabel: string;
  tickets: TicketRead[];
  onOpenTicket: (id: string) => void;
  accent: 'red' | 'emerald';
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-3 py-2">
        <span className={clsx('text-sm font-semibold', accent === 'red' ? 'text-red-300' : 'text-emerald-300')}>
          {title}
        </span>
        <span className="ml-2 text-xs text-zinc-500">({tickets.length})</span>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {tickets.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">{emptyLabel}</div>
        ) : (
          tickets.slice(0, 8).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTicket(t.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-800/40"
            >
              <span className="font-mono text-xs text-zinc-500">#{t.nummer}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-100">{t.titel}</span>
              <span className="text-xs text-zinc-500">{t.faelligkeit_am}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
