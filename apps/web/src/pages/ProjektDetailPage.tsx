import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  FolderKanban,
  Pencil,
  Plus,
  User,
} from 'lucide-react';
import clsx from 'clsx';
import { projektApi } from '../api/endpoints';
import type { ProjektCreate, ProjektRead, TicketRead } from '../api/types';
import { ProjektModal } from '../components/ProjektModal';
import { PrioBadge, StatusBadge } from '../components/StatusBadge';
import { TicketErfassenModal } from './TicketErfassenModal';

const STATUS_FALLBACK_COLOR: Record<string, string> = {
  geplant: 'sky',
  aktiv: 'emerald',
  pausiert: 'amber',
  abgeschlossen: 'zinc',
};

function pillClasses(farbe: string | null): string {
  switch (farbe) {
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'sky':
    case 'blue':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'amber':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'red':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'violet':
    case 'purple':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'zinc':
    default:
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  }
}

function StatusPill({
  keyValue,
  label,
  farbe,
}: {
  keyValue: string;
  label: string;
  farbe: string | null;
}) {
  const resolved = farbe ?? STATUS_FALLBACK_COLOR[keyValue] ?? null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        pillClasses(resolved),
      )}
    >
      {label}
    </span>
  );
}

function TypPill({ label, farbe }: { label: string; farbe: string | null }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        pillClasses(farbe),
      )}
    >
      {label}
    </span>
  );
}

function formatDateRange(p: ProjektRead): string {
  if (!p.start_am && !p.ende_am) return '—';
  return `${p.start_am ?? '?'} → ${p.ende_am ?? '?'}`;
}

export function ProjektDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projektId = id ?? '';
  const qc = useQueryClient();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const projektQuery = useQuery({
    queryKey: ['projekt', projektId],
    queryFn: () => projektApi.get(projektId),
    enabled: !!projektId,
  });

  const ticketsQuery = useQuery({
    queryKey: ['projekt-tickets', projektId],
    queryFn: () => projektApi.getTickets(projektId, { limit: 200 }),
    enabled: !!projektId,
  });

  const update = useMutation({
    mutationFn: (payload: ProjektCreate) => projektApi.update(projektId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projekt', projektId] });
      qc.invalidateQueries({ queryKey: ['projekte'] });
      setShowEditModal(false);
    },
  });

  const tickets: TicketRead[] = useMemo(
    () => ticketsQuery.data?.items ?? [],
    [ticketsQuery.data],
  );

  if (!projektId) {
    return (
      <div className="p-6 text-sm text-zinc-500">Kein Projekt ausgewählt.</div>
    );
  }

  if (projektQuery.isLoading) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500 lg:px-8">
        Lade Projekt …
      </div>
    );
  }

  if (projektQuery.isError || !projektQuery.data) {
    return (
      <div className="space-y-3 px-4 py-6 lg:px-8">
        <Link
          to="/projekte"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Projekte
        </Link>
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Projekt nicht gefunden oder Fehler beim Laden.
        </div>
      </div>
    );
  }

  const p = projektQuery.data;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          to="/projekte"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Projekte
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
              <FolderKanban className="h-5 w-5 text-emerald-400" /> {p.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TypPill label={p.projekttyp.label} farbe={p.projekttyp.farbe} />
              <StatusPill
                keyValue={p.status.key}
                label={p.status.label}
                farbe={p.status.farbe}
              />
              {p.verantwortlich && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-0.5 text-xs text-zinc-300">
                  <User className="h-3 w-3" />
                  {p.verantwortlich.full_name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-0.5 text-xs text-zinc-300">
                <Calendar className="h-3 w-3" />
                {formatDateRange(p)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" /> Bearbeiten
          </button>
        </div>
      </div>

      {/* Metadaten-Block */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Beschreibung
          </h2>
          {p.beschreibung ? (
            <p className="whitespace-pre-line text-sm text-zinc-200">
              {p.beschreibung}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">— keine Beschreibung —</p>
          )}
          {p.notizen && (
            <>
              <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Notizen
              </h2>
              <p className="whitespace-pre-line text-sm text-zinc-300">
                {p.notizen}
              </p>
            </>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Objekte ({p.objekte.length})
          </h2>
          {p.objekte.length === 0 ? (
            <p className="text-sm text-zinc-500">
              — keine Objekte verknüpft —
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.objekte.map((o) => (
                <Link
                  key={o.id}
                  to={`/stammdaten/objekte/${o.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Building2 className="h-3 w-3" />
                  {o.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Eingebettete Ticket-Liste */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Tickets ({ticketsQuery.data?.total ?? tickets.length})
            </h2>
            <p className="text-xs text-zinc-500">
              Alle Tickets, die diesem Projekt zugeordnet sind
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Neues Ticket
          </button>
        </div>

        {ticketsQuery.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Lade Tickets …
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FolderKanban className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">
              Noch keine Tickets in diesem Projekt.
            </p>
            <button
              type="button"
              onClick={() => setShowTicketModal(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              <Plus className="h-3.5 w-3.5" /> Erstes Ticket anlegen
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-950/40">
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Titel</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Prio</th>
                  <th className="px-3 py-2">Zugewiesen</th>
                  <th className="px-3 py-2">Erstellt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-zinc-800/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                      #{t.nummer}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/tickets/${t.id}`}
                        className="text-zinc-100 hover:text-emerald-300"
                      >
                        {t.titel}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2">
                      <PrioBadge prioritaet={t.prioritaet} />
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-300">
                      {t.zugewiesen_an?.full_name ?? (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {new Date(t.created_at).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjektModal
        open={showEditModal}
        initial={p}
        onClose={() => setShowEditModal(false)}
        onSubmit={(payload) => update.mutate(payload)}
        isPending={update.isPending}
      />

      {showTicketModal && (
        <TicketErfassenModal
          defaultProjektId={projektId}
          onClose={() => setShowTicketModal(false)}
          onCreated={() => {
            setShowTicketModal(false);
            void ticketsQuery.refetch();
            qc.invalidateQueries({ queryKey: ['projekt', projektId] });
          }}
        />
      )}
    </div>
  );
}
