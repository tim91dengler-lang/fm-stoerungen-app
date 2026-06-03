import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Inbox,
} from 'lucide-react';
import clsx from 'clsx';
import { ticketApi } from '../api/endpoints';
import type { TicketRead } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';

/**
 * „Meine Tickets" — kompakte, mobil-first Arbeitsliste der mir zugewiesenen
 * Tickets. Stat-/Filter-Chips oben (Offen / Dringend / Wartet / Überfällig),
 * darunter die offenen Tickets nach Priorität sortiert mit Ort + Fälligkeit +
 * Wartet-Grund je Zeile. Erledigte sind standardmäßig eingeklappt (Tim 2026-06-03).
 */

type Filter = 'alle' | 'dringend' | 'wartet' | 'ueberfaellig';

const PRIO_RANK: Record<string, number> = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
const PRIO_BAR: Record<string, string> = {
  kritisch: 'border-l-red-500',
  hoch: 'border-l-orange-500',
  mittel: 'border-l-amber-500/70',
  niedrig: 'border-l-zinc-600',
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isUeberfaellig(t: TicketRead): boolean {
  return !!t.faelligkeit_am && new Date(t.faelligkeit_am) < startOfToday();
}
function isDringend(t: TicketRead): boolean {
  return t.prioritaet.key === 'kritisch' || t.prioritaet.key === 'hoch';
}
function fmtDay(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('.');
}
function ortLabel(t: TicketRead): string | null {
  const parts = [
    t.haus?.bezeichnung,
    t.stockwerk?.bezeichnung,
    t.einheit?.bezeichnung,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function MeineTicketsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('alle');
  const [showErledigt, setShowErledigt] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ['meine-tickets', user?.id],
    queryFn: () =>
      user
        ? ticketApi.list({ zugewiesen_an_id: user.id, limit: 200 })
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    enabled: !!user,
  });

  const items = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data]);

  const offen = useMemo(
    () =>
      items
        .filter((t) => t.status.key !== 'erledigt')
        .sort((a, b) => {
          const pr =
            (PRIO_RANK[a.prioritaet.key] ?? 9) - (PRIO_RANK[b.prioritaet.key] ?? 9);
          if (pr !== 0) return pr;
          // Fälligkeit zuerst (frühestes oben, ohne Datum nach hinten)
          const fa = a.faelligkeit_am ?? '9999';
          const fb = b.faelligkeit_am ?? '9999';
          return fa.localeCompare(fb);
        }),
    [items],
  );
  const erledigt = useMemo(
    () => items.filter((t) => t.status.key === 'erledigt'),
    [items],
  );

  const counts = useMemo(
    () => ({
      alle: offen.length,
      dringend: offen.filter(isDringend).length,
      wartet: offen.filter((t) => t.status.key === 'wartet').length,
      ueberfaellig: offen.filter(isUeberfaellig).length,
    }),
    [offen],
  );

  const gefiltert = useMemo(() => {
    switch (filter) {
      case 'dringend':
        return offen.filter(isDringend);
      case 'wartet':
        return offen.filter((t) => t.status.key === 'wartet');
      case 'ueberfaellig':
        return offen.filter(isUeberfaellig);
      default:
        return offen;
    }
  }, [offen, filter]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 lg:px-6">
      <h1 className="text-xl font-semibold text-zinc-100">Meine Tickets</h1>
      <p className="mb-3 text-xs text-zinc-500">{user?.full_name ?? 'mir'} zugewiesen</p>

      {/* Stat-/Filter-Chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip
          label="Offen"
          count={counts.alle}
          active={filter === 'alle'}
          onClick={() => setFilter('alle')}
          tone="emerald"
        />
        <Chip
          label="Dringend"
          count={counts.dringend}
          active={filter === 'dringend'}
          onClick={() => setFilter(filter === 'dringend' ? 'alle' : 'dringend')}
          tone="red"
        />
        <Chip
          label="Wartet"
          count={counts.wartet}
          active={filter === 'wartet'}
          onClick={() => setFilter(filter === 'wartet' ? 'alle' : 'wartet')}
          tone="orange"
        />
        <Chip
          label="Überfällig"
          count={counts.ueberfaellig}
          active={filter === 'ueberfaellig'}
          onClick={() => setFilter(filter === 'ueberfaellig' ? 'alle' : 'ueberfaellig')}
          tone="amber"
        />
      </div>

      {/* Offene Tickets */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {ticketsQuery.isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">Lade …</div>
        ) : gefiltert.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            {offen.length === 0 ? (
              <>
                <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500/70" />
                Keine offenen Tickets. 🎉
              </>
            ) : (
              <>
                <Inbox className="mx-auto mb-2 h-7 w-7 text-zinc-700" />
                Keine Tickets in diesem Filter.
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {gefiltert.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </ul>
        )}
      </div>

      {/* Erledigte — standardmäßig eingeklappt */}
      {erledigt.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowErledigt((v) => !v)}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            {showErledigt ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Erledigt ({erledigt.length})
          </button>
          {showErledigt && (
            <ul className="divide-y divide-zinc-800/60 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
              {erledigt.map((t) => (
                <TicketRow key={t.id} t={t} muted />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: 'emerald' | 'red' | 'orange' | 'amber';
}) {
  const toneRing: Record<typeof tone, string> = {
    emerald: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
    red: 'border-red-500/60 bg-red-500/15 text-red-300',
    orange: 'border-orange-500/60 bg-orange-500/15 text-orange-300',
    amber: 'border-amber-500/60 bg-amber-500/15 text-amber-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? toneRing[tone]
          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
      )}
    >
      {label}
      <span
        className={clsx(
          'rounded-full px-1.5 text-[11px] tabular-nums',
          active ? 'bg-black/20' : 'bg-zinc-800 text-zinc-300',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TicketRow({ t, muted = false }: { t: TicketRead; muted?: boolean }) {
  const ort = ortLabel(t);
  const ueberfaellig = isUeberfaellig(t);
  return (
    <li>
      <Link
        to={`/tickets/${t.id}`}
        className={clsx(
          'block border-l-2 px-3 py-2 hover:bg-zinc-800/40',
          muted
            ? 'border-l-zinc-700 opacity-70'
            : (PRIO_BAR[t.prioritaet.key] ?? 'border-l-zinc-600'),
        )}
      >
        {/* Zeile 1: Nr + Titel + Badges */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-zinc-500">
            #{t.nummer}
          </span>
          <span className="flex-1 truncate text-sm text-zinc-100">{t.titel}</span>
          <PrioBadge prioritaet={t.prioritaet} />
          <StatusBadge status={t.status} />
        </div>
        {/* Zeile 2: Kontext (Ort / Fälligkeit / Wartet) — füllt sinnvoll, wrappt mobil */}
        {(t.objekt || ort || t.faelligkeit_am || t.wartet_grund) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[26px] text-[11px] text-zinc-500">
            {t.objekt && (
              <span className="inline-flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                {t.objekt.name}
                {ort ? ` · ${ort}` : ''}
              </span>
            )}
            {t.faelligkeit_am && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1',
                  ueberfaellig ? 'font-medium text-red-400' : 'text-zinc-500',
                )}
              >
                <Calendar className="h-3 w-3" />
                {ueberfaellig ? 'überfällig ' : 'fällig '}
                {fmtDay(t.faelligkeit_am)}
              </span>
            )}
            {t.wartet_grund && (
              <span className="inline-flex items-center gap-1 text-orange-300/80">
                <Hourglass className="h-3 w-3" />
                {t.wartet_grund.label}
              </span>
            )}
          </div>
        )}
      </Link>
    </li>
  );
}
