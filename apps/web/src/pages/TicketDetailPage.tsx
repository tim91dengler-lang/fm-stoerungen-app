import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ticketApi, userApi } from '../api/endpoints';
import type {
  TicketPrioritaet,
  TicketStatus,
  TicketUpdate,
} from '../api/types';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { formatDateTime } from '../lib/format';

const STATUS_OPTIONS: TicketStatus[] = [
  'neu',
  'zugewiesen',
  'in_arbeit',
  'erledigt',
  'geschlossen',
];
const PRIO_OPTIONS: TicketPrioritaet[] = ['niedrig', 'mittel', 'hoch', 'kritisch'];

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketApi.get(id!),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (payload: TicketUpdate) => ticketApi.update(id!, payload),
    onSuccess: (data) => {
      qc.setQueryData(['ticket', id], data);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setError(null);
    },
    onError: () => setError('Speichern fehlgeschlagen.'),
  });

  const remove = useMutation({
    mutationFn: () => ticketApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      navigate('/tickets');
    },
    onError: () => setError('Löschen fehlgeschlagen.'),
  });

  if (!id) return null;
  if (ticketQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-slate-500">Lade …</div>
    );
  }
  if (ticketQuery.error || !ticketQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Ticket nicht gefunden.{' '}
          <Link to="/tickets" className="underline">
            Zur Liste
          </Link>
        </div>
      </div>
    );
  }

  const t = ticketQuery.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link to="/tickets" className="hover:underline">
          ← Tickets
        </Link>
        <span>/</span>
        <span className="font-mono">#{t.nummer}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t.titel}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={t.status} />
          <PrioBadge prioritaet={t.prioritaet} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Beschreibung
            </h2>
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {t.beschreibung || 'Keine Beschreibung erfasst.'}
            </p>
          </section>
        </div>

        <aside className="space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Status</h2>
            <select
              value={t.status}
              onChange={(e) =>
                update.mutate({ status: e.target.value as TicketStatus })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Priorität
            </h2>
            <select
              value={t.prioritaet}
              onChange={(e) =>
                update.mutate({
                  prioritaet: e.target.value as TicketPrioritaet,
                })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {PRIO_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Zugewiesen an
            </h2>
            <select
              value={t.zugewiesen_an?.id ?? ''}
              onChange={(e) =>
                update.mutate({ zugewiesen_an_id: e.target.value || null })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— (offen)</option>
              {usersQuery.data?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Verlauf
            </h2>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <dt>Eröffnet von</dt>
                <dd className="font-medium text-slate-800">
                  {t.eroeffnet_von.full_name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Eröffnet am</dt>
                <dd>{formatDateTime(t.eroeffnet_am)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Zugewiesen am</dt>
                <dd>{formatDateTime(t.zugewiesen_am)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Erledigt am</dt>
                <dd>{formatDateTime(t.erledigt_am)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Geschlossen am</dt>
                <dd>{formatDateTime(t.geschlossen_am)}</dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            onClick={() => {
              if (confirm('Ticket wirklich löschen?')) remove.mutate();
            }}
            className="w-full rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Ticket löschen
          </button>
        </aside>
      </div>
    </div>
  );
}
