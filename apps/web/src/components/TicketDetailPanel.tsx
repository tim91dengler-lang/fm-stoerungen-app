import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Trash2,
  User,
  Users2,
  X,
} from 'lucide-react';
import { ticketApi, userApi } from '../api/endpoints';
import type {
  TicketPrioritaetSlug,
  TicketRead,
  TicketStatusSlug,
  TicketUpdate,
} from '../api/types';
import { PrioBadge } from './StatusBadge';
import { ChatPanel } from './ChatPanel';
import { PhotoGallery } from './PhotoGallery';
import {
  PRIO_SLUGS,
  STATUS_SLUGS,
  formatRelativeDateTime,
  labelForPrioSlug,
  labelForStatusSlug,
} from '../lib/format';

interface Props {
  ticketId: string | null;
  onClose: () => void;
}

export function TicketDetailPanel({ ticketId, onClose }: Props) {
  const qc = useQueryClient();

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketApi.get(ticketId!),
    enabled: !!ticketId,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });

  const update = useMutation({
    mutationFn: (payload: TicketUpdate) =>
      ticketApi.update(ticketId!, payload),
    onSuccess: (data) => {
      qc.setQueryData(['ticket', ticketId], data);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-kpi'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => ticketApi.remove(ticketId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-kpi'] });
      onClose();
    },
  });

  // ESC schließt das Panel
  useEffect(() => {
    if (!ticketId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ticketId, onClose]);

  if (!ticketId) return null;

  const t = ticketQuery.data;

  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Ticket-Detail"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="flex-1 bg-zinc-950/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl lg:max-w-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-zinc-500">
              #{t?.nummer ?? '…'}
            </span>
            {t && <PrioBadge prioritaet={t.prioritaet} />}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Panel schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!t && (
            <div className="px-5 py-6 text-sm text-zinc-500">
              {ticketQuery.isLoading ? 'Lade Ticket …' : 'Ticket nicht gefunden.'}
            </div>
          )}
          {t && (
            <div className="space-y-4 px-5 py-4">
              <h1 className="text-xl font-semibold text-zinc-100">{t.titel}</h1>
              <p className="text-xs text-zinc-500">
                Erfasst: {formatRelativeDateTime(t.eroeffnet_am)} · Melder:{' '}
                <span className="text-zinc-300">{t.eroeffnet_von.full_name}</span>
              </p>

              {/* Status / Priorität / Kategorie */}
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Status"
                  value={t.status.key}
                  onChange={(v) =>
                    update.mutate({ status: v as TicketStatusSlug })
                  }
                  options={STATUS_SLUGS.map((s) => ({
                    value: s,
                    label: labelForStatusSlug(s),
                  }))}
                />
                <SelectField
                  label="Priorität"
                  value={t.prioritaet.key}
                  onChange={(v) =>
                    update.mutate({ prioritaet: v as TicketPrioritaetSlug })
                  }
                  options={PRIO_SLUGS.map((p) => ({
                    value: p,
                    label: labelForPrioSlug(p),
                  }))}
                />
                <SelectField
                  label="Kategorie"
                  value={t.kategorie?.key ?? ''}
                  onChange={(v) =>
                    update.mutate({ kategorie: v || null })
                  }
                  options={[
                    { value: '', label: '— (keine) —' },
                    ...(t.kategorie ? [{ value: t.kategorie.key, label: t.kategorie.label }] : []),
                  ]}
                  // Die volle Kategorie-Liste kommt aus der Auswahlliste; hier
                  // zeigen wir den aktuellen Wert als Pre-fill an. Erweiterung
                  // erfolgt im Erfassungs-Modal.
                  disabled
                />
              </div>

              {/* Stammdaten-Block (collapsible) */}
              <Accordion title="Stammdaten" defaultOpen>
                <div className="space-y-2 text-sm">
                  <RowItem
                    icon={<MapPin className="h-4 w-4" />}
                    label="Objekt"
                    value={t.objekt?.name ?? '—'}
                  />
                  <RowItem
                    icon={<Users2 className="h-4 w-4" />}
                    label="Partner"
                    value={t.partner?.name ?? '—'}
                  />
                </div>
              </Accordion>

              {/* Beschreibung */}
              <Accordion title="Beschreibung" defaultOpen>
                <p className="whitespace-pre-wrap text-sm text-zinc-200">
                  {t.beschreibung || (
                    <em className="text-zinc-500">
                      Keine Beschreibung erfasst.
                    </em>
                  )}
                </p>
              </Accordion>

              {/* Zuweisung */}
              <Accordion title="Zugewiesen an" defaultOpen>
                <select
                  value={t.zugewiesen_an?.id ?? ''}
                  onChange={(e) =>
                    update.mutate({
                      zugewiesen_an_id: e.target.value || null,
                    })
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="">— (offen) —</option>
                  {usersQuery.data?.items.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </Accordion>

              <PhotoGallery ticketId={t.id} />

              <ChatPanel ticketId={t.id} />

              {/* Verlauf */}
              <Accordion title="Verlauf">
                <dl className="space-y-1 text-xs text-zinc-400">
                  <TimelineEntry
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Eröffnet"
                    value={`${formatRelativeDateTime(t.eroeffnet_am)} · ${t.eroeffnet_von.full_name}`}
                  />
                  <TimelineEntry
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Zugewiesen"
                    value={formatRelativeDateTime(t.zugewiesen_am)}
                  />
                  <TimelineEntry
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Erledigt"
                    value={formatRelativeDateTime(t.erledigt_am)}
                  />
                </dl>
              </Accordion>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Ticket wirklich löschen?')) remove.mutate();
                  }}
                  disabled={remove.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Ticket löschen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status-Banner bei Mutation-Errors */}
        {update.isError && (
          <div className="shrink-0 border-t border-red-500/30 bg-red-500/10 px-5 py-2 text-xs text-red-300">
            Speichern fehlgeschlagen.
          </div>
        )}
      </aside>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-md border border-zinc-800 bg-zinc-900"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="border-t border-zinc-800 px-3 py-3">{children}</div>
    </details>
  );
}

function RowItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-zinc-200">
      <span className="mt-0.5 text-zinc-500">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function TimelineEntry({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/60 py-1 last:border-b-0">
      <span className="flex items-center gap-1.5">
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

export type { TicketRead };
