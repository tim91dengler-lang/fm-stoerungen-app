import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ticketApi } from '../api/endpoints';
import type { TicketPrioritaetSlug, TicketStatusSlug } from '../api/types';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { TicketErfassenModal } from './TicketErfassenModal';
import {
  PRIO_SLUGS,
  STATUS_SLUGS,
  formatDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';

export function TicketsListePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatusSlug[]>([
    'neu',
    'pruefung',
    'bearbeitung',
    'wartet',
  ]);
  const [prioFilter, setPrioFilter] = useState<TicketPrioritaetSlug[]>([]);
  const [showErfassen, setShowErfassen] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      prioritaet: prioFilter.length > 0 ? prioFilter : undefined,
      limit: 100,
    }),
    [search, statusFilter, prioFilter],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketApi.list(filters),
  });

  function toggleStatus(s: TicketStatusSlug) {
    setStatusFilter((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }
  function togglePrio(p: TicketPrioritaetSlug) {
    setPrioFilter((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.total} Treffer` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowErfassen(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          Neues Ticket
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Suche in Titel und Beschreibung …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <div className="flex flex-wrap gap-1">
            {STATUS_SLUGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  statusFilter.includes(s)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {labelForStatusSlug(s)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {PRIO_SLUGS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePrio(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  prioFilter.includes(p)
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {labelForPrioSlug(p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Lade Tickets …
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler beim Laden.{' '}
          <button onClick={() => refetch()} className="underline">
            Erneut versuchen
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Keine Tickets gefunden. Filter ändern oder ein neues Ticket anlegen.
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Nr.</th>
                <th className="px-4 py-2 font-medium">Titel</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Priorität</th>
                <th className="px-4 py-2 font-medium">Zugewiesen an</th>
                <th className="px-4 py-2 font-medium">Eröffnet am</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    #{t.nummer}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/tickets/${t.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {t.titel}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2">
                    <PrioBadge prioritaet={t.prioritaet} />
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {t.zugewiesen_an?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {formatDateTime(t.eroeffnet_am)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showErfassen && (
        <TicketErfassenModal
          onClose={() => setShowErfassen(false)}
          onCreated={() => {
            setShowErfassen(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
