import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { ticketApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { formatRelativeDateTime } from '../lib/format';

export function MeineTicketsPage() {
  const { user } = useAuth();
  const ticketsQuery = useQuery({
    queryKey: ['meine-tickets', user?.id],
    queryFn: () =>
      user
        ? ticketApi.list({ zugewiesen_an_id: user.id, limit: 200 })
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    enabled: !!user,
  });

  const offen = useMemo(
    () =>
      (ticketsQuery.data?.items ?? []).filter(
        (t) => t.status.key !== 'erledigt',
      ),
    [ticketsQuery.data],
  );
  const erledigt = useMemo(
    () =>
      (ticketsQuery.data?.items ?? []).filter(
        (t) => t.status.key === 'erledigt',
      ),
    [ticketsQuery.data],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-zinc-100">
          Meine Tickets
        </h1>
        <p className="text-sm text-zinc-500">
          Tickets, die {user?.full_name ?? 'mir'} zugewiesen sind
        </p>
      </div>

      <Section
        title={`Offen (${offen.length})`}
        empty="Keine offenen Tickets. 🎉"
        items={offen}
      />
      <Section
        title={`Erledigt (${erledigt.length})`}
        empty="Noch nichts erledigt."
        items={erledigt}
        muted
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  empty: string;
  items: {
    id: string;
    nummer: number;
    titel: string;
    status: { id: string; key: string; label: string; farbe: string | null };
    prioritaet: { id: string; key: string; label: string; farbe: string | null };
    eroeffnet_am: string;
  }[];
  muted?: boolean;
}

function Section({ title, empty, items, muted = false }: SectionProps) {
  return (
    <div className="mb-6">
      <h2
        className={`mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${muted ? 'text-zinc-500' : 'text-zinc-300'}`}
      >
        <Activity className="h-4 w-4" /> {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            {empty}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tickets/${t.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40"
                >
                  <span className="font-mono text-xs text-zinc-500">
                    #{t.nummer}
                  </span>
                  <span className="flex-1 truncate text-sm text-zinc-200">
                    {t.titel}
                  </span>
                  <PrioBadge prioritaet={t.prioritaet} />
                  <StatusBadge status={t.status} />
                  <span className="hidden text-xs text-zinc-500 sm:inline">
                    {formatRelativeDateTime(t.eroeffnet_am)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
