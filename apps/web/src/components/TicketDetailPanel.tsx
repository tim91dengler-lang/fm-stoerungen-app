import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  auswahllistenApi,
  objektstrukturApi,
  statusWorkflowApi,
  ticketApi,
  tickettypApi,
  userApi,
} from '../api/endpoints';
import { formatAdresse, mapsUrl } from '../lib/adresse';
import type {
  StatusWertMini,
  TicketBeteiligterRead,
  TicketRead,
  TicketStatusSlug,
  TicketUpdate,
} from '../api/types';
import { ChatPanel } from './ChatPanel';
import { vorlageFelder } from '../lib/vorlageFelder';
import { aktiveWerte } from '../lib/aktiveWerte';
import { formatRelativeDateTime } from '../lib/format';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import { buildVorlageLayout } from '../lib/vorlageLayout';
import { TicketFormEngine } from './ticket/TicketFormEngine';
import { renderDetailFeld } from './ticket/detailFieldRenderers';

interface Props {
  ticketId: string | null;
  onClose: () => void;
}

interface PendingSwitch {
  tickettypId: string;
  labels: string[];
  patch: TicketUpdate;
}

// Felder, die beim Vorlage-Wechsel geleert werden, wenn die neue Vorlage sie
// nicht führt (Konzept "Das Ticket" §3, Tim 2026-05-31: saubere Auswertungen,
// Audit hält den Altwert). Status & Priorität bleiben (Pflicht); Foto/Dokumente
// sind eigene Entitäten und werden nicht angefasst.
const FELD_NULL_CONFIG: {
  feldKey: string;
  label: string;
  hasValue: (t: TicketRead) => boolean;
  patch: TicketUpdate;
}[] = [
  {
    feldKey: 'objekt',
    label: 'Objekt/Ort',
    hasValue: (t) => !!t.objekt,
    patch: { objekt_id: null, haus_id: null, stockwerk_id: null, einheit_id: null },
  },
  {
    feldKey: 'haus',
    label: 'Haus',
    hasValue: (t) => !!t.haus,
    patch: { haus_id: null, stockwerk_id: null, einheit_id: null },
  },
  {
    feldKey: 'stockwerk',
    label: 'Stockwerk',
    hasValue: (t) => !!t.stockwerk,
    patch: { stockwerk_id: null, einheit_id: null },
  },
  {
    feldKey: 'einheit',
    label: 'Einheit',
    hasValue: (t) => !!t.einheit,
    patch: { einheit_id: null },
  },
  {
    feldKey: 'anlage',
    label: 'Anlage',
    hasValue: (t) => !!t.anlage,
    patch: { anlage_id: null },
  },
  {
    feldKey: 'partner',
    label: 'Partner',
    hasValue: (t) => !!t.partner,
    patch: { partner_id: null },
  },
  {
    feldKey: 'adresse',
    label: 'Adresse',
    hasValue: (t) => !!t.adresse_id,
    patch: { adresse_id: null },
  },
  {
    feldKey: 'kategorie',
    label: 'Kategorie',
    hasValue: (t) => !!t.kategorie,
    patch: { kategorie: null },
  },
  {
    feldKey: 'quelle',
    label: 'Quelle',
    hasValue: (t) => !!t.quelle,
    patch: { quelle: null },
  },
  {
    feldKey: 'projekt',
    label: 'Projekt',
    hasValue: (t) => !!t.projekt,
    patch: { projekt_id: null },
  },
  {
    feldKey: 'fehlercode',
    label: 'Fehlercode',
    hasValue: (t) => !!t.fehlercode,
    patch: { fehlercode_id: null },
  },
  {
    feldKey: 'faelligkeit_am',
    label: 'Fälligkeitsdatum',
    hasValue: (t) => !!t.faelligkeit_am,
    patch: { faelligkeit_am: null },
  },
  {
    feldKey: 'wiederholung',
    label: 'Wiederholung',
    hasValue: (t) => !!t.wiederholung,
    patch: { wiederholung: null },
  },
  {
    feldKey: 'beschreibung',
    label: 'Beschreibung',
    hasValue: (t) => !!t.beschreibung,
    patch: { beschreibung: '' },
  },
  {
    feldKey: 'pin',
    label: 'Grundriss-Pins',
    hasValue: (t) => (t.pins ?? []).length > 0,
    patch: { pins: [] },
  },
];

/** Baut einen mailto-Entwurf mit Ticket-Zusammenfassung (Konzept §9, Stufe 1). */
function buildBeteiligteMailto(t: TicketRead): string {
  const ort = [
    t.objekt?.name,
    t.haus?.bezeichnung,
    t.stockwerk?.bezeichnung,
    t.einheit?.bezeichnung,
  ]
    .filter(Boolean)
    .join(' › ');
  const lines = [
    `Ticket #${t.nummer}: ${t.titel}`,
    `Status: ${t.status.label} · Priorität: ${t.prioritaet.label}`,
    ort ? `Ort: ${ort}` : '',
    t.adresse ? `Adresse: ${formatAdresse(t.adresse)}` : '',
    t.adresse ? `Karte: ${mapsUrl(t.adresse)}` : '',
    t.partner ? `Partner: ${t.partner.name}` : '',
    t.faelligkeit_am ? `Fällig: ${t.faelligkeit_am}` : '',
    '',
    t.beschreibung || '',
  ].filter((l) => l !== '');
  const wartetBeteiligter = t.beteiligte.find((b) => b.id === t.wartet_beteiligter_id);
  const to = wartetBeteiligter?.email ?? t.wartet_kontakt_email ?? '';
  const subject = `Ticket #${t.nummer}: ${t.titel}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function TicketDetailPanel({ ticketId, onClose }: Props) {
  const qc = useQueryClient();
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketApi.get(ticketId!),
    enabled: !!ticketId,
  });
  const t0 = ticketQuery.data;

  const usersQuery = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });

  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
    enabled: !!ticketId,
  });

  // Vorlage (Tickettyp) inkl. Felder — steuert Sichtbarkeit/Pflicht der Felder.
  const tickettypQuery = useQuery({
    queryKey: ['tickettyp', t0?.tickettyp?.id],
    queryFn: () => tickettypApi.get(t0!.tickettyp!.id),
    enabled: !!t0?.tickettyp?.id,
    staleTime: 60_000,
  });
  // Alle aktiven Vorlagen (inkl. felder) — für den Vorlage-Wechsel.
  const tickettypenQuery = useQuery({
    queryKey: ['tickettypen', 'aktiv_only'],
    queryFn: () => tickettypApi.list({ aktiv_only: true }),
    staleTime: 5 * 60_000,
    enabled: !!ticketId,
  });
  // Konfigurierbare Status-Übergangsmatrix — steuert die Workflow-Buttons.
  const workflowQuery = useQuery({
    queryKey: ['status-workflow'],
    queryFn: () => statusWorkflowApi.get(),
    staleTime: 5 * 60_000,
    enabled: !!ticketId,
  });

  const hausTreeQuery = useQuery({
    queryKey: ['haus-tree', t0?.objekt?.id],
    queryFn: () => objektstrukturApi.listHaus(t0!.objekt!.id),
    enabled: !!t0?.objekt?.id,
    staleTime: 30_000,
  });
  const felder = useMemo(
    () => vorlageFelder(tickettypQuery.data ?? null),
    [tickettypQuery.data],
  );

  const switchOptions = useMemo(() => {
    const list = (tickettypenQuery.data ?? []).map((x) => ({ id: x.id, label: x.label }));
    if (t0?.tickettyp && !list.some((x) => x.id === t0.tickettyp!.id)) {
      return [{ id: t0.tickettyp.id, label: `${t0.tickettyp.label} (inaktiv)` }, ...list];
    }
    return list;
  }, [tickettypenQuery.data, t0?.tickettyp]);

  const kategorienListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'ticket_kategorie',
  );
  const quellenListe = auswahllistenQuery.data?.find((l) => l.key === 'eingangskanal');
  const wartetGruendeListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'wartet_grund',
  );
  const beteiligtenRolleListe = auswahllistenQuery.data?.find(
    (l) => l.key === 'beteiligten_rolle',
  );

  const hausTree = hausTreeQuery.data;
  const update = useMutation({
    mutationFn: (payload: TicketUpdate) => ticketApi.update(ticketId!, payload),
    onSuccess: (data) => {
      qc.setQueryData(['ticket', ticketId], data);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-kpi'] });
    },
  });

  function startTitleEdit(current: string) {
    setTitleDraft(current);
    setTitleEditing(true);
  }
  function commitTitle(current: string) {
    const v = titleDraft.trim();
    if (v && v !== current) update.mutate({ titel: v });
    setTitleEditing(false);
  }

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
      if (e.key !== 'Escape') return;
      // Escape in einem Eingabefeld (z. B. Titel-Edit) bricht nur dieses ab,
      // schließt NICHT das Panel.
      const el = document.activeElement;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ticketId, onClose]);

  // Titel-Edit beim Ticketwechsel zurücksetzen (kein Übertrag des Entwurfs).
  useEffect(() => {
    setTitleEditing(false);
  }, [ticketId]);

  if (!ticketId) return null;

  const t = ticketQuery.data;

  function handleVorlageWechsel(newTypId: string) {
    if (!t || !newTypId || newTypId === t.tickettyp?.id) return;
    const newTyp = tickettypenQuery.data?.find((x) => x.id === newTypId) ?? null;
    const nf = vorlageFelder(newTyp);
    const betroffen = FELD_NULL_CONFIG.filter(
      (c) => !nf.sichtbar(c.feldKey) && c.hasValue(t),
    );
    if (betroffen.length === 0) {
      update.mutate({ tickettyp_id: newTypId });
      return;
    }
    const patch: TicketUpdate = { tickettyp_id: newTypId };
    for (const c of betroffen) Object.assign(patch, c.patch);
    setPendingSwitch({
      tickettypId: newTypId,
      labels: betroffen.map((c) => c.label),
      patch,
    });
  }

  const workflow = workflowQuery.data;
  const statusByKey = new Map<string, StatusWertMini>(
    (workflow?.status ?? []).map((s) => [s.key, s]),
  );
  const statusTargets: StatusWertMini[] = t
    ? (workflow?.uebergaenge[t.status.key] ?? [])
        .map((k) => statusByKey.get(k))
        .filter((s): s is StatusWertMini => !!s)
    : [];
  // "wartet auf"-Hook: Sub-Grund-Erfassung anzeigen, wenn der aktuelle Status
  // ihn verlangt (konfigurierbar; Fallback auf den klassischen "wartet"-Key).
  const statusErfordertGrund = t
    ? (statusByKey.get(t.status.key)?.erfordert_grund ?? t.status.key === 'wartet')
    : false;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-zinc-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ticket-Detail"
      onClick={onClose}
    >
      {/* Zentriertes Modal (konsistent zum Anlegen-Dialog) */}
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono">#{t?.nummer ?? '…'}</span>
              {t?.tickettyp && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tickettypClass(t.tickettyp.farbe)}`}
                >
                  <Wrench className="h-3 w-3" /> {t.tickettyp.label}
                </span>
              )}
              {t?.projekt && (
                <Link
                  to={`/projekte/${t.projekt.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/20"
                >
                  <FolderKanban className="h-3 w-3" /> {t.projekt.name}
                </Link>
              )}
              {statusErfordertGrund && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Wartet
                </span>
              )}
            </div>
            {titleEditing && t ? (
              <input
                autoFocus
                value={titleDraft}
                maxLength={200}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => commitTitle(t.titel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle(t.titel);
                  } else if (e.key === 'Escape') {
                    setTitleEditing(false);
                  }
                }}
                className="mt-0.5 w-full rounded border border-emerald-500/50 bg-zinc-900 px-1.5 py-0.5 text-lg font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                aria-label="Titel bearbeiten"
              />
            ) : (
              <h1
                className="group mt-0.5 flex cursor-text items-center gap-1.5 text-lg font-semibold text-zinc-100"
                onClick={() => t && startTitleEdit(t.titel)}
                title="Titel bearbeiten"
              >
                <span className="truncate">{t?.titel ?? '…'}</span>
                {t && (
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </h1>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {t && (
              <a
                href={buildBeteiligteMailto(t)}
                className="flex min-h-11 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300 lg:min-h-0"
                title="E-Mail an Beteiligte (Entwurf öffnen)"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">E-Mail</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:min-h-0 lg:min-w-0"
              aria-label="Panel schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 lg:flex-row lg:gap-0 lg:overflow-hidden lg:p-0">
          {!t && (
            <div className="px-1 py-2 text-sm text-zinc-500">
              {ticketQuery.isLoading ? 'Lade Ticket …' : 'Ticket nicht gefunden.'}
            </div>
          )}
          {t && (
              <TicketFormEngine
                layout={buildVorlageLayout(tickettypQuery.data ?? null)}
                renderFeld={(feld) =>
                  renderDetailFeld(feld.feld_key, {
                    t,
                    felder,
                    onPatch: (patch) => update.mutate(patch),
                    hausTree,
                    kategorienListe,
                    quellenListe,
                    beteiligtenRolleOptions: aktiveWerte(
                      beteiligtenRolleListe?.werte,
                    ).map((w) => ({
                      key: w.key,
                      label: w.label,
                    })),
                  })
                }
                leftHeaderSlot={
                  <div className="order-1 space-y-3 lg:order-none">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Status"
                        value={t.status.key}
                        onChange={(v) => {
                          if (v !== t.status.key)
                            update.mutate({ status: v as TicketStatusSlug });
                        }}
                        options={[
                          { value: t.status.key, label: t.status.label },
                          ...statusTargets.map((s) => ({ value: s.key, label: s.label })),
                        ]}
                      />
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          Zugewiesen an
                        </label>
                        <select
                          value={t.zugewiesen_an?.id ?? ''}
                          onChange={(e) =>
                            update.mutate({ zugewiesen_an_id: e.target.value || null })
                          }
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        >
                          <option value="">— (offen) —</option>
                          {usersQuery.data?.items.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {switchOptions.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          Vorlage
                        </label>
                        <select
                          value={t.tickettyp?.id ?? ''}
                          onChange={(e) => handleVorlageWechsel(e.target.value)}
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        >
                          {!t.tickettyp && <option value="">— (keine) —</option>}
                          {switchOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {statusErfordertGrund && (
                      <WartetSubBar
                        ticket={t}
                        wartetGruende={aktiveWerte(
                          wartetGruendeListe?.werte,
                          t.wartet_grund?.key,
                        )}
                        onSave={(payload) => update.mutate(payload)}
                      />
                    )}
                  </div>
                }
                leftFooterSlot={
                  <div className="order-7 lg:order-none">
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
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 lg:min-h-0"
                      >
                        <Trash2 className="h-4 w-4" /> Ticket löschen
                      </button>
                    </div>
                  </div>
                }
                chatSlot={
                  <div className="order-6 lg:order-first">
                    <ChatPanel ticketId={t.id} />
                  </div>
                }
              />
          )}
        </div>

        {/* Status-Banner bei Mutation-Errors */}
        {update.isError && (
          <div className="shrink-0 border-t border-red-500/30 bg-red-500/10 px-5 py-2 text-xs text-red-300">
            Speichern fehlgeschlagen.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingSwitch}
        title="Vorlage wechseln?"
        message={
          pendingSwitch
            ? `Die neue Vorlage führt diese Felder nicht — sie werden geleert: ${pendingSwitch.labels.join(', ')}. Der Verlauf hält die alten Werte fest.`
            : ''
        }
        confirmLabel="Wechseln & leeren"
        tone="primary"
        busy={update.isPending}
        onConfirm={() => {
          if (pendingSwitch) update.mutate(pendingSwitch.patch);
          setPendingSwitch(null);
        }}
        onCancel={() => setPendingSwitch(null)}
      />
    </div>
  );
}

function tickettypClass(farbe: string | null): string {
  switch (farbe) {
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'blue':
      return 'bg-sky-500/15 text-sky-300';
    case 'amber':
      return 'bg-amber-500/15 text-amber-300';
    default:
      return 'bg-zinc-700/50 text-zinc-300';
  }
}

interface WartetSubBarProps {
  ticket: TicketRead;
  wartetGruende: { id: string; key: string; label: string; farbe: string | null }[];
  onSave: (payload: TicketUpdate) => void;
}

function WartetSubBar({ ticket, wartetGruende, onSave }: WartetSubBarProps) {
  const grund = ticket.wartet_grund;
  // Bei Mieter/Extern/Material wartet man typisch auf eine konkrete Person —
  // jetzt einer der Ticket-Beteiligten (löst die früheren Freitext-Kontaktfelder ab).
  const showBeteiligter =
    grund?.key === 'mieter' || grund?.key === 'extern' || grund?.key === 'material';

  const beteiligte = ticket.beteiligte;
  const selected = beteiligte.find((b) => b.id === ticket.wartet_beteiligter_id) ?? null;
  const selectedTel = selected?.telefon || selected?.mobil || null;
  // Altdaten aus den abgelösten Freitextfeldern — nur Lese-Hinweis, bis ein
  // Beteiligter gewählt ist (Bestandstickets verlieren ihre Info nicht).
  const legacy = [
    ticket.wartet_kontakt_name,
    ticket.wartet_kontakt_telefon,
    ticket.wartet_kontakt_email,
  ]
    .filter(Boolean)
    .join(' · ');

  function beteiligterLabel(b: TicketBeteiligterRead): string {
    const base = b.kontakt?.name
      ? `${b.partner.name} · ${b.kontakt.name}`
      : b.partner.name;
    return b.rolle ? `${base} (${b.rolle.label})` : base;
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Wartet auf …
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] text-zinc-400">Grund</label>
          <select
            value={grund?.key ?? ''}
            onChange={(e) => onSave({ wartet_grund: e.target.value || null })}
            className="mt-0.5 w-full rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          >
            <option value="">— (keiner) —</option>
            {wartetGruende.map((w) => (
              <option key={w.id} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        {showBeteiligter && (
          <div className="sm:col-span-2">
            <label className="block text-[10px] text-zinc-400">
              Warte auf (Beteiligten wählen)
            </label>
            {beteiligte.length === 0 ? (
              <p className="mt-0.5 rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-400">
                Noch keine Beteiligten — oben im Block „Kontakt &amp; Beteiligte“
                hinzufügen, dann hier auswählen.
              </p>
            ) : (
              <select
                value={ticket.wartet_beteiligter_id ?? ''}
                onChange={(e) =>
                  onSave({ wartet_beteiligter_id: e.target.value || null })
                }
                className="mt-0.5 w-full rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="">— (keiner) —</option>
                {beteiligte.map((b) => (
                  <option key={b.id} value={b.id}>
                    {beteiligterLabel(b)}
                  </option>
                ))}
              </select>
            )}

            {selected && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                <span className="text-zinc-400">Kontakt (aus Stamm):</span>
                {selectedTel && (
                  <a
                    href={`tel:${selectedTel}`}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1 text-amber-300 hover:bg-zinc-800"
                    title="Anrufen"
                  >
                    <Phone className="h-3.5 w-3.5" /> {selectedTel}
                  </a>
                )}
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Ticket #${ticket.nummer}: ${ticket.titel}`)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1 text-amber-300 hover:bg-zinc-800"
                    title="E-Mail schreiben"
                  >
                    <Mail className="h-3.5 w-3.5" /> {selected.email}
                  </a>
                )}
                {!selectedTel && !selected.email && (
                  <span className="text-zinc-500">— keine Kontaktdaten im Stamm —</span>
                )}
              </div>
            )}

            {!selected && legacy && (
              <p className="mt-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-400">
                Alt-Kontakt (bitte oben als Beteiligten anlegen und hier wählen): {legacy}
              </p>
            )}
          </div>
        )}
      </div>
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
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 lg:min-h-0">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="border-t border-zinc-800 px-3 py-3">{children}</div>
    </details>
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
