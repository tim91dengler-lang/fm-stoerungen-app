import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  Home,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  Star,
  Ticket as TicketIcon,
  Trash2,
  User,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  auswahllistenApi,
  partnerApi,
  ticketApi,
} from '../api/endpoints';
import type {
  AdresseRead,
  AuswahllisteRead,
  AuswahllistenWertRead,
  PartnerKontaktCreate,
  PartnerKontaktRead,
  PartnerRead,
  PartnerTyp,
} from '../api/types';
import { AdresseSearchSelect } from '../components/AdresseSearchSelect';

const TYP_LABEL: Record<PartnerTyp, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
  privatperson: 'Privatperson',
};

// ============================================================================
// Hauptseite
// ============================================================================

export function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const partnerId = id ?? '';

  const partnerQuery = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnerApi.get(partnerId),
    enabled: !!partnerId,
  });

  // Auswahllisten — wir laden alle einmal und filtern client-side per key.
  const listenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  // Filialen direkt am Partner hängen (Backend liefert nur parent-Beziehung,
  // wir fragen die Children separat).
  const filialenQuery = useQuery({
    queryKey: ['partner-filialen', partnerId],
    queryFn: () =>
      partnerApi.list({
        parent_partner_id: partnerId,
        gesperrt_filter: 'alle',
        limit: 100,
      }),
    enabled: !!partnerId,
  });

  // Tickets zum Partner
  const ticketsQuery = useQuery({
    queryKey: ['partner-tickets', partnerId],
    queryFn: () => ticketApi.list({ partner_id: partnerId, limit: 10 }),
    enabled: !!partnerId,
  });

  const sperrenMut = useMutation({
    mutationFn: (vars: { sperren: boolean }) =>
      vars.sperren
        ? partnerApi.sperren(partnerId)
        : partnerApi.entsperren(partnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      qc.invalidateQueries({ queryKey: ['partner-filialen', partnerId] });
    },
  });

  if (!partnerId) {
    return <div className="p-6 text-sm text-zinc-500">Kein Partner ausgewählt.</div>;
  }
  if (partnerQuery.isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Lade …</div>;
  }
  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <div className="p-6 text-sm text-red-400">
        Partner konnte nicht geladen werden.
      </div>
    );
  }

  const partner = partnerQuery.data;
  const filialen = filialenQuery.data?.items ?? [];
  const tickets = ticketsQuery.data?.items ?? [];

  const listenByKey = new Map<string, AuswahllisteRead>();
  for (const l of listenQuery.data ?? []) listenByKey.set(l.key, l);

  const wertById = new Map<string, AuswahllistenWertRead>();
  for (const l of listenQuery.data ?? []) {
    for (const w of l.werte) wertById.set(w.id, w);
  }

  function labelOf(id: string | null): string | null {
    if (!id) return null;
    return wertById.get(id)?.label ?? null;
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/stammdaten/partner"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Geschäftspartner
          </Link>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Building2 className="h-5 w-5 text-emerald-400" />
            {partner.name}
            {partner.gesperrt && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                gesperrt
              </span>
            )}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {partner.typen.map((t) => (
              <span
                key={t}
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300"
              >
                {TYP_LABEL[t]}
              </span>
            ))}
            <span className="text-[11px] text-zinc-500">
              · Nr. {partner.partner_nummer}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              sperrenMut.mutate({ sperren: !partner.gesperrt })
            }
            className={clsx(
              'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium',
              partner.gesperrt
                ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                : 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10',
            )}
          >
            {partner.gesperrt ? (
              <>
                <Play className="h-3.5 w-3.5" /> Entsperren
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" /> Sperren
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Linke Spalte */}
        <div className="space-y-4">
          <StammdatenSection partner={partner} labelOf={labelOf} />
          <StrukturSection
            partner={partner}
            filialen={filialen}
            onOpenFiliale={(fid) => navigate(`/stammdaten/partner/${fid}`)}
          />
          <KontakteSection partner={partner} listen={listenByKey} wertById={wertById} />
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-4">
          <AdressenSection partner={partner} listen={listenByKey} wertById={wertById} />
          <VerknuepfungenSection
            partner={partner}
            ticketsCount={tickets.length}
            filialenCount={filialen.length}
          />
          <TicketsSection tickets={tickets} />
          <DokumenteSection />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sektion: Stammdaten (read-only Anzeige)
// ============================================================================

function StammdatenSection({
  partner,
  labelOf,
}: {
  partner: PartnerRead;
  labelOf: (id: string | null) => string | null;
}) {
  return (
    <Section title="Stammdaten">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Rechtsform" value={labelOf(partner.rechtsform_id)} />
        <Row label="Branche" value={labelOf(partner.branche_id)} />
        <Row label="USt-IdNr." value={partner.ust_id_nr} />
        <Row label="Steuer-Nr." value={partner.steuer_nr} />
        <Row label="HRB" value={partner.hrb} />
        <Row
          label="Website"
          value={
            partner.website ? (
              <a
                href={partner.website}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 hover:underline"
              >
                {partner.website}
              </a>
            ) : null
          }
        />
        <Row label="Anrede" value={labelOf(partner.anrede_id)} />
        <Row
          label="Person"
          value={
            [partner.titel, partner.vorname, partner.nachname]
              .filter(Boolean)
              .join(' ') || null
          }
        />
        <Row label="E-Mail" value={partner.email} />
        <Row label="Telefon" value={partner.telefon} />
      </dl>
      {partner.notiz && (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/30 p-2 text-xs text-zinc-300">
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            Notiz
          </div>
          {partner.notiz}
        </div>
      )}
    </Section>
  );
}

// ============================================================================
// Sektion: Struktur (Hierarchie + Filialen)
// ============================================================================

function StrukturSection({
  partner,
  filialen,
  onOpenFiliale,
}: {
  partner: PartnerRead;
  filialen: PartnerRead[];
  onOpenFiliale: (id: string) => void;
}) {
  return (
    <Section title="Struktur">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
            Gehört zu
          </dt>
          {partner.parent_partner_id ? (
            <Link
              to={`/stammdaten/partner/${partner.parent_partner_id}`}
              className="text-emerald-300 hover:underline"
            >
              Mutter öffnen
            </Link>
          ) : (
            <dd className="text-zinc-500">— Top-Level —</dd>
          )}
        </div>
      </dl>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Filialen ({filialen.length})
          </span>
        </div>
        {filialen.length === 0 ? (
          <p className="text-xs text-zinc-500">Keine Filialen angelegt.</p>
        ) : (
          <ul className="space-y-1">
            {filialen.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpenFiliale(f.id)}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/30 px-2 py-1.5 text-left text-sm hover:border-emerald-500/40"
                >
                  <span className="flex items-center gap-2 text-zinc-200">
                    <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                    {f.name}
                    {f.gesperrt && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                        gesperrt
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// ============================================================================
// Sektion: Kontakte
// ============================================================================

function KontakteSection({
  partner,
  listen,
  wertById,
}: {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
  wertById: Map<string, AuswahllistenWertRead>;
}) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKontakt, setEditingKontakt] = useState<PartnerKontaktRead | null>(
    null,
  );

  const deleteMut = useMutation({
    mutationFn: (kontaktId: string) => partnerApi.removeKontakt(kontaktId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });

  function openCreate() {
    setEditingKontakt(null);
    setModalOpen(true);
  }
  function openEdit(k: PartnerKontaktRead) {
    setEditingKontakt(k);
    setModalOpen(true);
  }

  return (
    <Section
      title={`Kontakte (${partner.kontakte.length})`}
      action={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> Kontakt
        </button>
      }
    >
      {partner.kontakte.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Noch keine Kontaktpersonen angelegt.
        </p>
      ) : (
        <ul className="space-y-2">
          {partner.kontakte.map((k) => (
            <li
              key={k.id}
              className="group flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-950/30 p-2 hover:border-zinc-700"
            >
              <User className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {k.ist_hauptkontakt && (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  )}
                  <span className="text-sm text-zinc-100">
                    {[k.titel, k.vorname, k.nachname].filter(Boolean).join(' ') ||
                      '—'}
                  </span>
                  {k.gesperrt && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                      gesperrt
                    </span>
                  )}
                </div>
                {k.rollen.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {k.rollen.map((rid) => (
                      <span
                        key={rid}
                        className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
                      >
                        {wertById.get(rid)?.label ?? '?'}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  {k.email && <span>✉ {k.email}</span>}
                  {k.email && k.telefon && <span> · </span>}
                  {k.telefon && <span>📞 {k.telefon}</span>}
                  {k.mobil && (
                    <span>
                      {(k.email || k.telefon) && ' · '}📱 {k.mobil}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(k)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Bearbeiten"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Kontakt "${k.nachname ?? ''}" löschen?`)) {
                      deleteMut.mutate(k.id);
                    }
                  }}
                  className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <KontaktModal
          partnerId={partner.id}
          listen={listen}
          initial={editingKontakt}
          onClose={() => setModalOpen(false)}
        />
      )}
    </Section>
  );
}

// ============================================================================
// Sektion: Adressen (Junction)
// ============================================================================

function AdressenSection({
  partner,
  listen,
  wertById,
}: {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
  wertById: Map<string, AuswahllistenWertRead>;
}) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (linkId: string) => partnerApi.removeAdresse(linkId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { linkId: string; ist_primaer: boolean }) =>
      partnerApi.updateAdresse(vars.linkId, { ist_primaer: vars.ist_primaer }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });

  return (
    <Section
      title={`Adressen (${partner.adress_links.length})`}
      action={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> Adresse
        </button>
      }
    >
      {partner.adress_links.length === 0 ? (
        <p className="text-xs text-zinc-500">Keine Adressen verknüpft.</p>
      ) : (
        <ul className="space-y-2">
          {partner.adress_links.map((link) => (
            <li
              key={link.id}
              className="group flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-950/30 p-2"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {link.ist_primaer && (
                    <Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                  )}
                  {link.typ_id && (
                    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {wertById.get(link.typ_id)?.label ?? '?'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-200">
                  {link.adresse
                    ? `${link.adresse.strasse}${link.adresse.hausnummer ? ' ' + link.adresse.hausnummer : ''}, ${link.adresse.plz} ${link.adresse.ort}`
                    : '—'}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {!link.ist_primaer && (
                  <button
                    type="button"
                    onClick={() =>
                      updateMut.mutate({ linkId: link.id, ist_primaer: true })
                    }
                    className="rounded-md p-1 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                    title="Als primär markieren"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Adresse vom Partner entfernen?')) {
                      deleteMut.mutate(link.id);
                    }
                  }}
                  className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  title="Verknüpfung entfernen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <PartnerAdresseModal
          partnerId={partner.id}
          listen={listen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </Section>
  );
}

// ============================================================================
// Sektion: Verknüpfungen (Zähler-Übersicht)
// ============================================================================

function VerknuepfungenSection({
  partner,
  ticketsCount,
  filialenCount,
}: {
  partner: PartnerRead;
  ticketsCount: number;
  filialenCount: number;
}) {
  return (
    <Section title="Verknüpfungen">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <CounterTile
          icon={Briefcase}
          label="Filialen"
          value={filialenCount}
        />
        <CounterTile
          icon={TicketIcon}
          label="Tickets"
          value={ticketsCount}
        />
        <CounterTile
          icon={Home}
          label="Objekt-Verknüpfungen"
          value="—"
          hint="kommt in einer späteren Phase"
        />
        <CounterTile
          icon={User}
          label="Kontakte"
          value={partner.kontakte.length}
        />
      </div>
    </Section>
  );
}

function CounterTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-zinc-500" />
        <span className="text-xl font-semibold text-zinc-100">{value}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
  );
}

// ============================================================================
// Sektion: Tickets
// ============================================================================

interface PartnerTicketLike {
  id: string;
  nummer: number;
  titel: string;
  status: { label: string; farbe: string | null };
  eroeffnet_am: string;
}

function TicketsSection({ tickets }: { tickets: PartnerTicketLike[] }) {
  return (
    <Section
      title={`Tickets (${tickets.length})`}
      action={
        tickets.length > 0 ? (
          <Link
            to="/tickets"
            className="text-xs text-emerald-300 hover:underline"
          >
            alle anzeigen
          </Link>
        ) : null
      }
    >
      {tickets.length === 0 ? (
        <p className="text-xs text-zinc-500">Keine Tickets für diesen Partner.</p>
      ) : (
        <ul className="space-y-1">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets?ticket=${t.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/30 px-2 py-1.5 text-sm hover:border-zinc-700"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">
                    #{t.nummer}
                  </span>
                  <span className="truncate text-zinc-200">{t.titel}</span>
                </span>
                <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {t.status.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ============================================================================
// Sektion: Dokumente
// ============================================================================

function DokumenteSection() {
  return (
    <Section title="Dokumente" icon={FileText}>
      <p className="text-xs text-zinc-500">
        Verknüpfte Dokumente folgen — verknüpft via{' '}
        <code className="rounded bg-zinc-800 px-1 text-[10px]">
          dokument_links target=partner
        </code>
        .
      </p>
    </Section>
  );
}

// ============================================================================
// Modal: Kontakt anlegen / bearbeiten
// ============================================================================

function KontaktModal({
  partnerId,
  listen,
  initial,
  onClose,
}: {
  partnerId: string;
  listen: Map<string, AuswahllisteRead>;
  initial: PartnerKontaktRead | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const anreden = listen.get('anrede')?.werte ?? [];
  const rollenWerte = listen.get('kontakt_rolle')?.werte ?? [];

  const [form, setForm] = useState<PartnerKontaktCreate>(
    initial
      ? {
          anrede_id: initial.anrede_id,
          titel: initial.titel,
          vorname: initial.vorname,
          nachname: initial.nachname,
          rollen: initial.rollen,
          email: initial.email,
          telefon: initial.telefon,
          mobil: initial.mobil,
          ist_hauptkontakt: initial.ist_hauptkontakt,
          gesperrt: initial.gesperrt,
          notiz: initial.notiz,
        }
      : {
          rollen: [],
          ist_hauptkontakt: false,
          gesperrt: false,
        },
  );

  const createMut = useMutation({
    mutationFn: (payload: PartnerKontaktCreate) =>
      partnerApi.createKontakt(partnerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      onClose();
    },
  });
  const updateMut = useMutation({
    mutationFn: (payload: PartnerKontaktCreate) =>
      partnerApi.updateKontakt(initial!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      onClose();
    },
  });

  function toggleRolle(rid: string) {
    setForm((f) => ({
      ...f,
      rollen: (f.rollen ?? []).includes(rid)
        ? (f.rollen ?? []).filter((x) => x !== rid)
        : [...(f.rollen ?? []), rid],
    }));
  }

  function handleSubmit() {
    const payload: PartnerKontaktCreate = {
      ...form,
      email: form.email || null,
      telefon: form.telefon || null,
      mobil: form.mobil || null,
      titel: form.titel || null,
      vorname: form.vorname || null,
      nachname: form.nachname || null,
      notiz: form.notiz || null,
    };
    if (initial) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {initial ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Anrede
              </label>
              <select
                value={form.anrede_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, anrede_id: e.target.value || null })
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="">—</option>
                {anreden.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Titel
              </label>
              <input
                type="text"
                value={form.titel ?? ''}
                onChange={(e) => setForm({ ...form, titel: e.target.value })}
                placeholder="Dr., Prof., …"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Vorname
              </label>
              <input
                type="text"
                value={form.vorname ?? ''}
                onChange={(e) => setForm({ ...form, vorname: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Nachname
              </label>
              <input
                type="text"
                value={form.nachname ?? ''}
                onChange={(e) => setForm({ ...form, nachname: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Rollen (Mehrfachauswahl)
            </label>
            <div className="flex flex-wrap gap-1">
              {rollenWerte.map((r) => {
                const active = (form.rollen ?? []).includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRolle(r.id)}
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px]',
                      active
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                E-Mail
              </label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Telefon
              </label>
              <input
                type="text"
                value={form.telefon ?? ''}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Mobil
              </label>
              <input
                type="text"
                value={form.mobil ?? ''}
                onChange={(e) => setForm({ ...form, mobil: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={form.ist_hauptkontakt ?? false}
              onChange={(e) =>
                setForm({ ...form, ist_hauptkontakt: e.target.checked })
              }
            />
            Als Hauptkontakt markieren
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Notiz
            </label>
            <textarea
              rows={2}
              value={form.notiz ?? ''}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {isPending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modal: Adresse verknüpfen (existierende Adresse über Browse/Suche wählen)
// ============================================================================

function PartnerAdresseModal({
  partnerId,
  listen,
  onClose,
}: {
  partnerId: string;
  listen: Map<string, AuswahllisteRead>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const adresstypen = listen.get('adresstyp')?.werte ?? [];
  const [adresse, setAdresse] = useState<AdresseRead | null>(null);
  const [typId, setTypId] = useState<string>('');
  const [istPrimaer, setIstPrimaer] = useState(false);

  const createMut = useMutation({
    mutationFn: () =>
      partnerApi.createAdresse(partnerId, {
        adresse_id: adresse!.id,
        typ_id: typId || null,
        ist_primaer: istPrimaer,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partnerId] });
      onClose();
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            Adresse verknüpfen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <AdresseSearchSelect selected={adresse} onChange={setAdresse} />

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Adress-Typ
            </label>
            <select
              value={typId}
              onChange={(e) => setTypId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="">— keiner —</option>
              {adresstypen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={istPrimaer}
              onChange={(e) => setIstPrimaer(e.target.checked)}
            />
            Als primäre Adresse markieren
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => createMut.mutate()}
            disabled={!adresse || createMut.isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {createMut.isPending ? 'Speichere …' : 'Verknüpfen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Layout-Helpers
// ============================================================================

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: typeof FileText;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {Icon && <Icon className="h-3 w-3" />} {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | null;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="text-zinc-200">
        {value || <span className="text-zinc-600">—</span>}
      </dd>
    </div>
  );
}
