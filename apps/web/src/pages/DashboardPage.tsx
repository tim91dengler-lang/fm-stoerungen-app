import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Users,
} from 'lucide-react';
import { partnerApi, ticketApi, userApi } from '../api/endpoints';
import { KpiCards, type KpiItem } from '../components/KpiCards';
import { formatRelativeDateTime } from '../lib/format';
import { StatusBadge, PrioBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const ticketsQuery = useQuery({
    queryKey: ['dashboard-tickets'],
    queryFn: () => ticketApi.list({ limit: 200 }),
  });
  const usersQuery = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: () => userApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
  const partnerQuery = useQuery({
    queryKey: ['dashboard-partner'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const kpis: KpiItem[] = useMemo(() => {
    const all = ticketsQuery.data?.items ?? [];
    const offen = all.filter((t) => t.status.key !== 'erledigt').length;
    const wartet = all.filter((t) => t.status.key === 'wartet').length;
    const kritisch = all.filter(
      (t) => t.prioritaet.key === 'kritisch' && t.status.key !== 'erledigt',
    ).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const heuteErledigt = all.filter(
      (t) =>
        t.erledigt_am !== null && new Date(t.erledigt_am) >= startOfToday,
    ).length;
    return [
      {
        label: 'Offen',
        wert: offen,
        sub: 'alle Status außer erledigt',
        icon: Activity,
        accent: 'emerald',
      },
      {
        label: 'Wartet',
        wert: wartet,
        sub: 'Material / Mieter / Freigabe',
        icon: Clock,
        accent: 'amber',
      },
      {
        label: 'Kritisch',
        wert: kritisch,
        sub: 'Priorität P1',
        icon: Flame,
        accent: 'red',
      },
      {
        label: 'Heute erledigt',
        wert: heuteErledigt,
        sub: 'Tagesleistung',
        icon: CheckCircle2,
        accent: 'zinc',
      },
    ];
  }, [ticketsQuery.data]);

  // Auslastung Techniker: pro User offene Tickets zählen
  const auslastung = useMemo(() => {
    const all = ticketsQuery.data?.items ?? [];
    const users = usersQuery.data?.items ?? [];
    const map = new Map<string, number>();
    for (const t of all) {
      if (t.status.key === 'erledigt') continue;
      if (!t.zugewiesen_an) continue;
      map.set(t.zugewiesen_an.id, (map.get(t.zugewiesen_an.id) ?? 0) + 1);
    }
    return users
      .map((u) => ({ user: u, offene: map.get(u.id) ?? 0 }))
      .sort((a, b) => b.offene - a.offene)
      .slice(0, 5);
  }, [ticketsQuery.data, usersQuery.data]);

  // Top-Partner nach Ticket-Aufkommen
  const topPartner = useMemo(() => {
    const all = ticketsQuery.data?.items ?? [];
    const partner = partnerQuery.data?.items ?? [];
    const map = new Map<string, number>();
    for (const t of all) {
      if (!t.partner) continue;
      map.set(t.partner.id, (map.get(t.partner.id) ?? 0) + 1);
    }
    return partner
      .map((p) => ({ partner: p, count: map.get(p.id) ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [ticketsQuery.data, partnerQuery.data]);

  // Letzte 5 Tickets
  const letzteTickets = useMemo(() => {
    const all = ticketsQuery.data?.items ?? [];
    return [...all]
      .sort(
        (a, b) =>
          new Date(b.eroeffnet_am).getTime() -
          new Date(a.eroeffnet_am).getTime(),
      )
      .slice(0, 5);
  }, [ticketsQuery.data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500">Überblick über Tickets und Team</p>
      </div>

      <KpiCards items={kpis} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Letzte Tickets" icon={<Activity className="h-4 w-4" />}>
          <ul className="divide-y divide-zinc-800/60">
            {letzteTickets.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                Keine Tickets.
              </li>
            )}
            {letzteTickets.map((t) => (
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
        </Card>

        <Card title="Auslastung Techniker" icon={<Users className="h-4 w-4" />}>
          <ul className="divide-y divide-zinc-800/60">
            {auslastung.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                Keine Daten.
              </li>
            )}
            {auslastung.map(({ user, offene }) => (
              <li
                key={user.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-xs font-semibold text-emerald-300">
                  {initials(user.full_name)}
                </div>
                <span className="flex-1 truncate text-zinc-200">
                  {user.full_name}
                </span>
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {offene}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Top-Geschäftspartner" icon={<AlertTriangle className="h-4 w-4" />}>
          <ul className="divide-y divide-zinc-800/60">
            {topPartner.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                Noch keine Geschäftspartner-Bezüge.
              </li>
            )}
            {topPartner.map(({ partner, count }) => (
              <li
                key={partner.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex-1 truncate text-zinc-200">
                  {partner.name}
                </span>
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <span className="text-zinc-400">{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
