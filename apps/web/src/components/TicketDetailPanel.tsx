import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  FolderKanban,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User,
  Users2,
  Wrench,
  X,
} from 'lucide-react';
import {
  anlageApi,
  auswahllistenApi,
  fehlercodeApi,
  objektApi,
  objektstrukturApi,
  partnerApi,
  projektApi,
  statusWorkflowApi,
  ticketApi,
  tickettypApi,
  userApi,
} from '../api/endpoints';
import type {
  StatusWertMini,
  TicketPrioritaetSlug,
  TicketRead,
  TicketStatusSlug,
  TicketUpdate,
} from '../api/types';
import { PrioBadge } from './StatusBadge';
import { ChatPanel } from './ChatPanel';
import { PhotoGallery } from './PhotoGallery';
import { TicketDokumente } from './TicketDokumente';
import { GrundrissPin } from './GrundrissPin';
import {
  PartnerKontaktPicker,
  type PartnerKontaktAuswahl,
} from './PartnerKontaktPicker';
import { vorlageFelder } from '../lib/vorlageFelder';
import { aktiveWerte } from '../lib/aktiveWerte';
import { PRIO_SLUGS, formatRelativeDateTime, labelForPrioSlug } from '../lib/format';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

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
  { feldKey: 'objekt', label: 'Objekt/Ort', hasValue: (t) => !!t.objekt, patch: { objekt_id: null, haus_id: null, stockwerk_id: null, einheit_id: null } },
  { feldKey: 'haus', label: 'Haus', hasValue: (t) => !!t.haus, patch: { haus_id: null, stockwerk_id: null, einheit_id: null } },
  { feldKey: 'stockwerk', label: 'Stockwerk', hasValue: (t) => !!t.stockwerk, patch: { stockwerk_id: null, einheit_id: null } },
  { feldKey: 'einheit', label: 'Einheit', hasValue: (t) => !!t.einheit, patch: { einheit_id: null } },
  { feldKey: 'anlage', label: 'Anlage', hasValue: (t) => !!t.anlage, patch: { anlage_id: null } },
  { feldKey: 'partner', label: 'Partner', hasValue: (t) => !!t.partner, patch: { partner_id: null } },
  { feldKey: 'kategorie', label: 'Kategorie', hasValue: (t) => !!t.kategorie, patch: { kategorie: null } },
  { feldKey: 'quelle', label: 'Quelle', hasValue: (t) => !!t.quelle, patch: { quelle: null } },
  { feldKey: 'melder', label: 'Melder', hasValue: (t) => !!t.melder, patch: { melder: null } },
  { feldKey: 'projekt', label: 'Projekt', hasValue: (t) => !!t.projekt, patch: { projekt_id: null } },
  { feldKey: 'fehlercode', label: 'Fehlercode', hasValue: (t) => !!t.fehlercode, patch: { fehlercode_id: null } },
  { feldKey: 'faelligkeit_am', label: 'Fälligkeitsdatum', hasValue: (t) => !!t.faelligkeit_am, patch: { faelligkeit_am: null } },
  { feldKey: 'wiederholung', label: 'Wiederholung', hasValue: (t) => !!t.wiederholung, patch: { wiederholung: null } },
  { feldKey: 'beschreibung', label: 'Beschreibung', hasValue: (t) => !!t.beschreibung, patch: { beschreibung: '' } },
  { feldKey: 'pin', label: 'Foto-Pin', hasValue: (t) => t.pin_x != null || t.pin_y != null, patch: { pin_x: null, pin_y: null } },
];

/** Baut einen mailto-Entwurf mit Ticket-Zusammenfassung (Konzept §9, Stufe 1). */
function buildBeteiligteMailto(t: TicketRead): string {
  const ort = [t.objekt?.name, t.haus?.bezeichnung, t.stockwerk?.bezeichnung, t.einheit?.bezeichnung]
    .filter(Boolean)
    .join(' › ');
  const lines = [
    `Ticket #${t.nummer}: ${t.titel}`,
    `Status: ${t.status.label} · Priorität: ${t.prioritaet.label}`,
    ort ? `Ort: ${ort}` : '',
    t.partner ? `Partner: ${t.partner.name}` : '',
    t.faelligkeit_am ? `Fällig: ${t.faelligkeit_am}` : '',
    '',
    t.beschreibung || '',
  ].filter((l) => l !== '');
  const to = t.wartet_kontakt_email ?? '';
  const subject = `Ticket #${t.nummer}: ${t.titel}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function TicketDetailPanel({ ticketId, onClose }: Props) {
  const qc = useQueryClient();
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

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

  const objekteQuery = useQuery({
    queryKey: ['objekte-for-ticket'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });
  const partnerAlleQuery = useQuery({
    queryKey: ['partner-for-ticket'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });
  const anlagenQuery = useQuery({
    queryKey: ['anlagen-for-ticket'],
    queryFn: () => anlageApi.list({ aktiv_only: true }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });
  const fehlercodesQuery = useQuery({
    queryKey: ['fehlercodes-for-ticket'],
    queryFn: () => fehlercodeApi.list({ aktiv_only: true }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });
  const projekteQuery = useQuery({
    queryKey: ['projekte-active'],
    queryFn: () => projektApi.list({ status: ['geplant', 'aktiv'] }),
    staleTime: 60_000,
    enabled: !!ticketId,
  });
  const hausTreeQuery = useQuery({
    queryKey: ['haus-tree', t0?.objekt?.id],
    queryFn: () => objektstrukturApi.listHaus(t0!.objekt!.id),
    enabled: !!t0?.objekt?.id,
    staleTime: 30_000,
  });

  const felder = useMemo(() => vorlageFelder(tickettypQuery.data ?? null), [tickettypQuery.data]);

  const switchOptions = useMemo(() => {
    const list = (tickettypenQuery.data ?? []).map((x) => ({ id: x.id, label: x.label }));
    if (t0?.tickettyp && !list.some((x) => x.id === t0.tickettyp!.id)) {
      return [{ id: t0.tickettyp.id, label: `${t0.tickettyp.label} (inaktiv)` }, ...list];
    }
    return list;
  }, [tickettypenQuery.data, t0?.tickettyp]);

  const kategorienListe = auswahllistenQuery.data?.find((l) => l.key === 'ticket_kategorie');
  const quellenListe = auswahllistenQuery.data?.find((l) => l.key === 'eingangskanal');
  const wartetGruendeListe = auswahllistenQuery.data?.find((l) => l.key === 'wartet_grund');

  const hausTree = hausTreeQuery.data;
  const selectedHaus = useMemo(
    () => hausTree?.find((h) => h.id === t0?.haus?.id) ?? null,
    [hausTree, t0?.haus?.id],
  );
  const selectedStockwerk = useMemo(
    () => selectedHaus?.stockwerke?.find((s) => s.id === t0?.stockwerk?.id) ?? null,
    [selectedHaus, t0?.stockwerk?.id],
  );

  const update = useMutation({
    mutationFn: (payload: TicketUpdate) => ticketApi.update(ticketId!, payload),
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

  function handleVorlageWechsel(newTypId: string) {
    if (!t || !newTypId || newTypId === t.tickettyp?.id) return;
    const newTyp = tickettypenQuery.data?.find((x) => x.id === newTypId) ?? null;
    const nf = vorlageFelder(newTyp);
    const betroffen = FELD_NULL_CONFIG.filter((c) => !nf.sichtbar(c.feldKey) && c.hasValue(t));
    if (betroffen.length === 0) {
      update.mutate({ tickettyp_id: newTypId });
      return;
    }
    const patch: TicketUpdate = { tickettyp_id: newTypId };
    for (const c of betroffen) Object.assign(patch, c.patch);
    setPendingSwitch({ tickettypId: newTypId, labels: betroffen.map((c) => c.label), patch });
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

  // Hat die Vorlage irgendein Ort-Feld sichtbar?
  const ortSichtbar =
    felder.sichtbar('objekt') ||
    felder.sichtbar('haus') ||
    felder.sichtbar('stockwerk') ||
    felder.sichtbar('einheit');
  const stammdatenSichtbar =
    ortSichtbar ||
    felder.sichtbar('partner') ||
    felder.sichtbar('anlage') ||
    felder.sichtbar('quelle') ||
    felder.sichtbar('melder') ||
    felder.sichtbar('projekt') ||
    felder.sichtbar('faelligkeit_am') ||
    felder.sichtbar('wiederholung') ||
    felder.sichtbar('fehlercode');

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
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-zinc-500">#{t?.nummer ?? '…'}</span>
            {t && <PrioBadge prioritaet={t.prioritaet} />}
          </div>
          <div className="flex items-center gap-1">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {!t && (
            <div className="px-5 py-6 text-sm text-zinc-500">
              {ticketQuery.isLoading ? 'Lade Ticket …' : 'Ticket nicht gefunden.'}
            </div>
          )}
          {t && (
            <>
            {/* LINKE SPALTE — Fakten & Bearbeitung */}
            <div className="space-y-4 px-5 py-4 lg:w-3/5 lg:overflow-y-auto">
              {/* Tickettyp-Pill */}
              {t.tickettyp && (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tickettypClass(t.tickettyp.farbe)}`}
                  >
                    <Wrench className="h-3 w-3" /> {t.tickettyp.label}
                  </span>
                  {t.projekt && (
                    <Link
                      to={`/projekte/${t.projekt.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
                    >
                      <FolderKanban className="h-3 w-3" /> {t.projekt.name}
                    </Link>
                  )}
                </div>
              )}

              <h1 className="text-xl font-semibold text-zinc-100">{t.titel}</h1>
              <p className="text-xs text-zinc-500">
                Erfasst: {formatRelativeDateTime(t.eroeffnet_am)} · von{' '}
                <span className="text-zinc-300">{t.eroeffnet_von.full_name}</span>
                {t.quelle && (
                  <>
                    {' '}
                    · Quelle: <span className="text-zinc-300">{t.quelle.label}</span>
                  </>
                )}
                {t.melder && (
                  <>
                    {' '}
                    · Melder: <span className="text-zinc-300">{t.melder}</span>
                  </>
                )}
              </p>

              {/* Vorlage (wechselbar) */}
              {switchOptions.length > 0 && (
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Vorlage
                  </label>
                  <select
                    value={t.tickettyp?.id ?? ''}
                    onChange={(e) => handleVorlageWechsel(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
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

              {/* Wartet-Sub-Bar — wenn der aktuelle Status den Sub-Grund-Hook hat */}
              {statusErfordertGrund && (
                <WartetSubBar
                  ticket={t}
                  wartetGruende={aktiveWerte(wartetGruendeListe?.werte, t.wartet_grund?.key)}
                  onSave={(payload) => update.mutate(payload)}
                />
              )}

              {/* Status / Priorität / Kategorie */}
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Status"
                  value={t.status.key}
                  onChange={(v) => {
                    if (v !== t.status.key) update.mutate({ status: v as TicketStatusSlug });
                  }}
                  options={[
                    { value: t.status.key, label: t.status.label },
                    ...statusTargets.map((s) => ({ value: s.key, label: s.label })),
                  ]}
                />
                {felder.sichtbar('prio') && (
                  <SelectField
                    label="Priorität"
                    value={t.prioritaet.key}
                    onChange={(v) => update.mutate({ prioritaet: v as TicketPrioritaetSlug })}
                    options={PRIO_SLUGS.map((p) => ({ value: p, label: labelForPrioSlug(p) }))}
                  />
                )}
                {felder.sichtbar('kategorie') && (
                  <SelectField
                    label="Kategorie"
                    value={t.kategorie?.key ?? ''}
                    onChange={(v) => update.mutate({ kategorie: v || null })}
                    options={[
                      { value: '', label: '— (keine) —' },
                      ...aktiveWerte(kategorienListe?.werte, t.kategorie?.key).map((w) => ({
                        value: w.key,
                        label: w.label,
                      })),
                    ]}
                  />
                )}
              </div>

              {/* Stammdaten (editierbar, vorlagengesteuert) */}
              {stammdatenSichtbar && (
                <Accordion title="Stammdaten" defaultOpen>
                  <div className="space-y-3 text-sm">
                    {ortSichtbar && (
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          <MapPin className="h-3.5 w-3.5" /> Ort
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {felder.sichtbar('objekt') && (
                            <FeldSelect
                              label="Objekt"
                              pflicht={felder.pflicht('objekt')}
                              value={t.objekt?.id ?? ''}
                              onChange={(v) =>
                                update.mutate({
                                  objekt_id: v || null,
                                  haus_id: null,
                                  stockwerk_id: null,
                                  einheit_id: null,
                                })
                              }
                            >
                              <option value="">— (keins) —</option>
                              {objekteQuery.data?.items.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </FeldSelect>
                          )}
                          {felder.sichtbar('haus') && (
                            <FeldSelect
                              label="Haus"
                              disabled={!t.objekt}
                              value={t.haus?.id ?? ''}
                              onChange={(v) =>
                                update.mutate({
                                  haus_id: v || null,
                                  stockwerk_id: null,
                                  einheit_id: null,
                                })
                              }
                            >
                              <option value="">— (keins) —</option>
                              {hausTree?.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.bezeichnung}
                                </option>
                              ))}
                            </FeldSelect>
                          )}
                          {felder.sichtbar('stockwerk') && (
                            <FeldSelect
                              label="Stockwerk"
                              disabled={!t.haus}
                              value={t.stockwerk?.id ?? ''}
                              onChange={(v) =>
                                update.mutate({ stockwerk_id: v || null, einheit_id: null })
                              }
                            >
                              <option value="">— (keins) —</option>
                              {selectedHaus?.stockwerke?.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.bezeichnung}
                                  {s.ausrichtung ? ` · ${s.ausrichtung}` : ''}
                                </option>
                              ))}
                            </FeldSelect>
                          )}
                          {felder.sichtbar('einheit') && (
                            <FeldSelect
                              label="Einheit"
                              disabled={!t.stockwerk}
                              value={t.einheit?.id ?? ''}
                              onChange={(v) => update.mutate({ einheit_id: v || null })}
                            >
                              <option value="">— (keine) —</option>
                              {selectedStockwerk?.einheiten?.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.bezeichnung}
                                </option>
                              ))}
                            </FeldSelect>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {felder.sichtbar('partner') && (
                        <FeldSelect
                          label="Partner"
                          icon={<Users2 className="h-3.5 w-3.5" />}
                          pflicht={felder.pflicht('partner')}
                          value={t.partner?.id ?? ''}
                          onChange={(v) => update.mutate({ partner_id: v || null })}
                        >
                          <option value="">— (keiner) —</option>
                          {partnerAlleQuery.data?.items.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </FeldSelect>
                      )}
                      {felder.sichtbar('anlage') && (
                        <FeldSelect
                          label="Anlage"
                          icon={<Activity className="h-3.5 w-3.5" />}
                          pflicht={felder.pflicht('anlage')}
                          value={t.anlage?.id ?? ''}
                          onChange={(v) => update.mutate({ anlage_id: v || null })}
                        >
                          <option value="">— (keine) —</option>
                          {anlagenQuery.data?.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.bezeichnung}
                            </option>
                          ))}
                        </FeldSelect>
                      )}
                      {felder.sichtbar('quelle') && (
                        <FeldSelect
                          label="Quelle"
                          value={t.quelle?.key ?? ''}
                          onChange={(v) => update.mutate({ quelle: v || null })}
                        >
                          <option value="">— (keine) —</option>
                          {aktiveWerte(quellenListe?.werte, t.quelle?.key).map((w) => (
                            <option key={w.id} value={w.key}>
                              {w.label}
                            </option>
                          ))}
                        </FeldSelect>
                      )}
                      {felder.sichtbar('melder') && (
                        <TextField
                          key={`melder-${t.id}`}
                          label="Melder / Anrufer"
                          defaultValue={t.melder ?? ''}
                          onCommit={(v) => update.mutate({ melder: v || null })}
                        />
                      )}
                      {felder.sichtbar('projekt') && (
                        <FeldSelect
                          label="Projekt"
                          icon={<FolderKanban className="h-3.5 w-3.5" />}
                          value={t.projekt?.id ?? ''}
                          onChange={(v) => update.mutate({ projekt_id: v || null })}
                        >
                          <option value="">— (keins) —</option>
                          {projekteQuery.data?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </FeldSelect>
                      )}
                      {felder.sichtbar('fehlercode') && (
                        <FeldSelect
                          label="Fehlercode"
                          icon={<AlertOctagon className="h-3.5 w-3.5 text-amber-400" />}
                          pflicht={felder.pflicht('fehlercode')}
                          value={t.fehlercode?.id ?? ''}
                          onChange={(v) => update.mutate({ fehlercode_id: v || null })}
                        >
                          <option value="">— (keiner) —</option>
                          {fehlercodesQuery.data?.map((fc) => (
                            <option key={fc.id} value={fc.id}>
                              {fc.code} — {fc.titel}
                            </option>
                          ))}
                        </FeldSelect>
                      )}
                      {felder.sichtbar('faelligkeit_am') && (
                        <div>
                          <label className="block text-xs text-zinc-400">
                            Fällig am
                            {felder.pflicht('faelligkeit_am') && <span className="text-red-400"> *</span>}
                          </label>
                          <input
                            type="date"
                            value={t.faelligkeit_am ?? ''}
                            onChange={(e) => update.mutate({ faelligkeit_am: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                          />
                        </div>
                      )}
                      {felder.sichtbar('wiederholung') && (
                        <FeldSelect
                          label="Wiederholung"
                          value={t.wiederholung ?? ''}
                          onChange={(v) => update.mutate({ wiederholung: v || null })}
                        >
                          <option value="">— (keine) —</option>
                          <option value="weekly">Wöchentlich</option>
                          <option value="monthly">Monatlich</option>
                          <option value="quarterly">Quartalsweise</option>
                          <option value="yearly">Jährlich</option>
                        </FeldSelect>
                      )}
                    </div>
                  </div>
                </Accordion>
              )}

              {/* Lage im Grundriss */}
              {felder.sichtbar('pin') && t.stockwerk?.has_grundriss && (
                <Accordion title="Lage im Grundriss" defaultOpen>
                  <GrundrissPin
                    stockwerkId={t.stockwerk.id}
                    pin={t.pin_x != null && t.pin_y != null ? { x: t.pin_x, y: t.pin_y } : null}
                  />
                </Accordion>
              )}

              {/* Beschreibung (editierbar) */}
              {felder.sichtbar('beschreibung') && (
                <Accordion title="Beschreibung" defaultOpen>
                  <textarea
                    key={`besch-${t.id}`}
                    rows={4}
                    defaultValue={t.beschreibung ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (t.beschreibung ?? '')) {
                        update.mutate({ beschreibung: e.target.value });
                      }
                    }}
                    placeholder="Details zur Störung"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </Accordion>
              )}

              {/* Zuweisung */}
              <Accordion title="Zugewiesen an" defaultOpen>
                <select
                  value={t.zugewiesen_an?.id ?? ''}
                  onChange={(e) => update.mutate({ zugewiesen_an_id: e.target.value || null })}
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
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 lg:min-h-0"
                >
                  <Trash2 className="h-4 w-4" /> Ticket löschen
                </button>
              </div>
            </div>
            {/* RECHTE SPALTE — Kommunikation & Belege */}
            <div className="space-y-4 border-t border-zinc-800 px-5 py-4 lg:w-2/5 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <ChatPanel ticketId={t.id} />
              {felder.sichtbar('foto') && <PhotoGallery ticketId={t.id} />}
              {felder.sichtbar('dokumente') && <TicketDokumente ticketId={t.id} />}
            </div>
            </>
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
  const showKontakt = grund?.key === 'mieter' || grund?.key === 'extern';
  const showNachunternehmer = grund?.key === 'material' || grund?.key === 'extern';
  const showKontaktBlock = showKontakt || showNachunternehmer;

  // Partner gewählt → Kontaktfelder aus dem Partner-Stamm vorbefüllen + ID setzen.
  function waehlePartner(p: PartnerKontaktAuswahl) {
    onSave({
      wartet_nachunternehmer_id: p.id,
      wartet_kontakt_name: p.ansprechpartner || p.name || null,
      wartet_kontakt_telefon: p.telefon || p.mobil || null,
      wartet_kontakt_email: p.email || null,
    });
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
        {showKontaktBlock && (
          <div className="sm:col-span-2">
            <label className="block text-[10px] text-zinc-400">
              Kontakt / Nachunternehmer (Geschäftspartner)
            </label>
            <PartnerKontaktPicker
              value={
                ticket.wartet_nachunternehmer
                  ? {
                      id: ticket.wartet_nachunternehmer.id,
                      name: ticket.wartet_nachunternehmer.name,
                    }
                  : null
              }
              onSelect={waehlePartner}
              onClear={() => onSave({ wartet_nachunternehmer_id: null })}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Auswahl füllt Name/Telefon/E-Mail automatisch — unten anpassbar.
            </p>
          </div>
        )}
        {showKontaktBlock && (
          <>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-zinc-400">Kontakt-Name</label>
              <input
                key={`wkname-${ticket.wartet_kontakt_name ?? ''}`}
                type="text"
                defaultValue={ticket.wartet_kontakt_name ?? ''}
                onBlur={(e) =>
                  e.target.value !== (ticket.wartet_kontakt_name ?? '') &&
                  onSave({ wartet_kontakt_name: e.target.value || null })
                }
                className="mt-0.5 w-full rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400">Telefon</label>
              <div className="mt-0.5 flex gap-1">
                <input
                  key={`wktel-${ticket.wartet_kontakt_telefon ?? ''}`}
                  type="text"
                  defaultValue={ticket.wartet_kontakt_telefon ?? ''}
                  onBlur={(e) =>
                    e.target.value !== (ticket.wartet_kontakt_telefon ?? '') &&
                    onSave({ wartet_kontakt_telefon: e.target.value || null })
                  }
                  className="flex-1 rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                />
                {ticket.wartet_kontakt_telefon && (
                  <a
                    href={`tel:${ticket.wartet_kontakt_telefon}`}
                    className="rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-amber-300 hover:bg-zinc-800"
                    title="Anrufen"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400">E-Mail</label>
              <div className="mt-0.5 flex gap-1">
                <input
                  key={`wkmail-${ticket.wartet_kontakt_email ?? ''}`}
                  type="email"
                  defaultValue={ticket.wartet_kontakt_email ?? ''}
                  onBlur={(e) =>
                    e.target.value !== (ticket.wartet_kontakt_email ?? '') &&
                    onSave({ wartet_kontakt_email: e.target.value || null })
                  }
                  className="flex-1 rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                />
                {ticket.wartet_kontakt_email && (
                  <a
                    href={`mailto:${ticket.wartet_kontakt_email}?subject=${encodeURIComponent(`Ticket #${ticket.nummer}: ${ticket.titel}`)}`}
                    className="rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-amber-300 hover:bg-zinc-800"
                    title="E-Mail schreiben"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </>
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

/** Editierbares Select für die Stammdaten-Sektion (Label + optionales Icon + Pflicht-Stern). */
function FeldSelect({
  label,
  value,
  onChange,
  children,
  disabled = false,
  pflicht = false,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  pflicht?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        {icon}
        {label}
        {pflicht && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

/** Editierbares Textfeld mit Commit beim Verlassen (onBlur). */
function TextField({
  label,
  defaultValue,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400">{label}</label>
      <input
        type="text"
        defaultValue={defaultValue}
        onBlur={(e) => e.target.value !== defaultValue && onCommit(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
      />
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
    <details open={defaultOpen} className="group rounded-md border border-zinc-800 bg-zinc-900">
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
