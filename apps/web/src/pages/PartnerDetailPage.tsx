import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  Home,
  MapPin,
  Pencil,
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
  PartnerCreate,
  PartnerKontaktCreate,
  PartnerKontaktRead,
  PartnerRead,
  PartnerTyp,
} from '../api/types';
import { AdresseSearchSelect } from '../components/AdresseSearchSelect';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

const TYP_LABEL_FALLBACK: Record<PartnerTyp, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
  privatperson: 'Privatperson',
};

/** Hilfsfunktion: leere Strings in null umwandeln, damit EmailStr & Co
 *  nicht 422 zurückgeben. */
function nullIfEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Simple Email-Validation. Leer ist ok (wird als null geschickt). */
function isValidEmailOrEmpty(v: string | null | undefined): boolean {
  if (!v || v.trim().length === 0) return true;
  // Minimal-Check: enthält genau einen @, links und rechts mind. 1 Zeichen,
  // rechts mindestens einen Punkt. Pydantic EmailStr ist strenger, aber
  // dieser Check fängt das häufigste „kein @"-Problem ab.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Extrahiert die Fehlermeldung aus einer Mutation-Error (Axios 422-Detail). */
function extractMutationError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const axiosErr = err as {
    response?: { data?: { detail?: unknown; message?: string } };
    message?: string;
  };
  const detail = axiosErr.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) => {
        const field = d.loc?.filter((x) => x !== 'body').join('.') ?? '?';
        return `${field}: ${d.msg ?? '?'}`;
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  return axiosErr.message ?? null;
}

// ============================================================================
// Hauptseite
// ============================================================================

export function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const partnerId = id ?? '';

  const partnerQuery = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnerApi.get(partnerId),
    enabled: !!partnerId,
  });

  const listenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

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

  const ticketsQuery = useQuery({
    queryKey: ['partner-tickets', partnerId],
    queryFn: () => ticketApi.list({ partner_id: partnerId, limit: 10 }),
    enabled: !!partnerId,
  });

  // Hooks müssen unconditional aufgerufen werden — daher Memo VOR den
  // Early-Returns.
  const listenByKey = useMemo(() => {
    const m = new Map<string, AuswahllisteRead>();
    for (const l of listenQuery.data ?? []) m.set(l.key, l);
    return m;
  }, [listenQuery.data]);

  const wertById = useMemo(() => {
    const m = new Map<string, AuswahllistenWertRead>();
    for (const l of listenQuery.data ?? []) {
      for (const w of l.werte) m.set(w.id, w);
    }
    return m;
  }, [listenQuery.data]);

  const partnerTypLabels = useMemo(() => {
    const m = new Map<string, string>(Object.entries(TYP_LABEL_FALLBACK));
    const liste = listenByKey.get('partner_typ');
    if (liste) {
      for (const w of liste.werte) m.set(w.key, w.label);
    }
    return m;
  }, [listenByKey]);

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

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      {/* Header — kein Sperren-Button mehr hier; Aktion erfolgt über die Liste oder per Bulk */}
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
              deaktiviert
            </span>
          )}
          <span className="text-[11px] font-normal text-zinc-500">
            · Nr. {partner.partner_nummer}
          </span>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {partner.typen.map((t) => (
            <span
              key={t}
              className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300"
            >
              {partnerTypLabels.get(t) ?? t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <StammdatenSection
            partner={partner}
            listen={listenByKey}
            partnerTypLabels={partnerTypLabels}
          />
          <StrukturSection
            partner={partner}
            filialen={filialen}
            onOpenFiliale={(fid) => navigate(`/stammdaten/partner/${fid}`)}
            partnerTypen={partner.typen}
          />
          <KontakteSection
            partner={partner}
            listen={listenByKey}
            wertById={wertById}
          />
        </div>

        <div className="space-y-4">
          <AdressenSection
            partner={partner}
            listen={listenByKey}
            wertById={wertById}
          />
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
// Sektion: Stammdaten — INLINE EDITIERBAR mit Speichern-Button + Dirty-Warnung
// ============================================================================

function StammdatenSection({
  partner,
  listen,
  partnerTypLabels,
}: {
  partner: PartnerRead;
  listen: Map<string, AuswahllisteRead>;
  partnerTypLabels: Map<string, string>;
}) {
  const qc = useQueryClient();
  const anreden = listen.get('anrede')?.werte ?? [];
  const rechtsformen = listen.get('rechtsform')?.werte ?? [];
  const branchen = listen.get('branche')?.werte ?? [];
  const titelWerte = listen.get('titel')?.werte ?? [];
  const typenListe = listen.get('partner_typ')?.werte ?? [];

  // Wenn die Auswahlliste leer ist, fallen wir auf die Fallback-Map zurück
  const typenOptions: { key: string; label: string }[] =
    typenListe.length > 0
      ? typenListe.map((w) => ({ key: w.key, label: w.label }))
      : Array.from(partnerTypLabels.entries()).map(([key, label]) => ({
          key,
          label,
        }));

  const [form, setForm] = useState<PartnerCreate>(() => ({
    name: partner.name,
    parent_partner_id: partner.parent_partner_id,
    rechtsform_id: partner.rechtsform_id,
    branche_id: partner.branche_id,
    anrede_id: partner.anrede_id,
    titel: partner.titel,
    vorname: partner.vorname,
    nachname: partner.nachname,
    ust_id_nr: partner.ust_id_nr,
    steuer_nr: partner.steuer_nr,
    hrb: partner.hrb,
    website: partner.website,
    email: partner.email,
    telefon: partner.telefon,
    notiz: partner.notiz,
    typen: partner.typen,
  }));

  // Reset Form wenn partner-Daten neu geladen werden
  useEffect(() => {
    setForm({
      name: partner.name,
      parent_partner_id: partner.parent_partner_id,
      rechtsform_id: partner.rechtsform_id,
      branche_id: partner.branche_id,
      anrede_id: partner.anrede_id,
      titel: partner.titel,
      vorname: partner.vorname,
      nachname: partner.nachname,
      ust_id_nr: partner.ust_id_nr,
      steuer_nr: partner.steuer_nr,
      hrb: partner.hrb,
      website: partner.website,
      email: partner.email,
      telefon: partner.telefon,
      notiz: partner.notiz,
      typen: partner.typen,
    });
  }, [partner.id, partner.updated_at]);  // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    return (
      form.name !== partner.name ||
      form.rechtsform_id !== partner.rechtsform_id ||
      form.branche_id !== partner.branche_id ||
      form.anrede_id !== partner.anrede_id ||
      (form.titel ?? '') !== (partner.titel ?? '') ||
      (form.vorname ?? '') !== (partner.vorname ?? '') ||
      (form.nachname ?? '') !== (partner.nachname ?? '') ||
      (form.ust_id_nr ?? '') !== (partner.ust_id_nr ?? '') ||
      (form.steuer_nr ?? '') !== (partner.steuer_nr ?? '') ||
      (form.hrb ?? '') !== (partner.hrb ?? '') ||
      (form.website ?? '') !== (partner.website ?? '') ||
      (form.email ?? '') !== (partner.email ?? '') ||
      (form.telefon ?? '') !== (partner.telefon ?? '') ||
      (form.notiz ?? '') !== (partner.notiz ?? '') ||
      JSON.stringify(form.typen) !== JSON.stringify(partner.typen)
    );
  }, [form, partner]);

  const emailInvalid = !isValidEmailOrEmpty(form.email);

  // Beim Verlassen der Seite warnen, wenn ungespeicherte Änderungen
  // (Pattern: useBlocker aus react-router v6 Data API + beforeunload).
  useDirtyFormWarning(isDirty);

  const updateMut = useMutation({
    mutationFn: () =>
      partnerApi.update(partner.id, {
        name: form.name,
        rechtsform_id: form.rechtsform_id,
        branche_id: form.branche_id,
        anrede_id: form.anrede_id,
        titel: nullIfEmpty(form.titel),
        vorname: nullIfEmpty(form.vorname),
        nachname: nullIfEmpty(form.nachname),
        ust_id_nr: nullIfEmpty(form.ust_id_nr),
        steuer_nr: nullIfEmpty(form.steuer_nr),
        hrb: nullIfEmpty(form.hrb),
        website: nullIfEmpty(form.website),
        email: nullIfEmpty(form.email),
        telefon: nullIfEmpty(form.telefon),
        notiz: nullIfEmpty(form.notiz),
        typen: form.typen,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['partner', partner.id] }),
  });

  function toggleTyp(key: string) {
    const k = key as PartnerTyp;
    setForm((f) => ({
      ...f,
      typen: f.typen.includes(k) ? f.typen.filter((x) => x !== k) : [...f.typen, k],
    }));
  }

  return (
    <Section title="Stammdaten">
      <div className="space-y-3 text-sm">
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={baseInputCls}
          />
        </Field>

        <Field label="Typen (Mehrfach)">
          <div className="flex flex-wrap gap-1">
            {typenOptions.map((t) => {
              const active = form.typen.includes(t.key as PartnerTyp);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTyp(t.key)}
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px]',
                    active
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rechtsform">
            <select
              value={form.rechtsform_id ?? ''}
              onChange={(e) =>
                setForm({ ...form, rechtsform_id: e.target.value || null })
              }
              className={baseInputCls}
            >
              <option value="">—</option>
              {rechtsformen.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branche">
            <select
              value={form.branche_id ?? ''}
              onChange={(e) =>
                setForm({ ...form, branche_id: e.target.value || null })
              }
              className={baseInputCls}
            >
              <option value="">—</option>
              {branchen.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="USt-IdNr.">
            <input
              type="text"
              value={form.ust_id_nr ?? ''}
              onChange={(e) => setForm({ ...form, ust_id_nr: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Steuer-Nr.">
            <input
              type="text"
              value={form.steuer_nr ?? ''}
              onChange={(e) => setForm({ ...form, steuer_nr: e.target.value })}
              className={baseInputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="HRB">
            <input
              type="text"
              value={form.hrb ?? ''}
              onChange={(e) => setForm({ ...form, hrb: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Website">
            <input
              type="text"
              value={form.website ?? ''}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://…"
              className={baseInputCls}
            />
          </Field>
        </div>

        <Field label="Anrede (für Anschriften)">
          <select
            value={form.anrede_id ?? ''}
            onChange={(e) =>
              setForm({ ...form, anrede_id: e.target.value || null })
            }
            className={baseInputCls}
          >
            <option value="">—</option>
            {anreden.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[150px_1fr_1fr] gap-3">
          <Field label="Titel">
            <select
              value={form.titel ?? ''}
              onChange={(e) =>
                setForm({ ...form, titel: e.target.value || null })
              }
              className={baseInputCls}
            >
              <option value="">—</option>
              {titelWerte.map((w) => (
                <option key={w.id} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vorname">
            <input
              type="text"
              value={form.vorname ?? ''}
              onChange={(e) => setForm({ ...form, vorname: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Nachname">
            <input
              type="text"
              value={form.nachname ?? ''}
              onChange={(e) => setForm({ ...form, nachname: e.target.value })}
              className={baseInputCls}
            />
          </Field>
        </div>

        <Field label="E-Mail">
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={clsx(
              baseInputCls,
              emailInvalid && 'border-amber-500/50',
            )}
          />
          {emailInvalid && (
            <p className="mt-1 text-[10px] text-amber-400">
              Ungültige E-Mail (muss ein @ enthalten oder leer sein).
            </p>
          )}
        </Field>
        <Field label="Telefon">
          <input
            type="text"
            value={form.telefon ?? ''}
            onChange={(e) => setForm({ ...form, telefon: e.target.value })}
            className={baseInputCls}
          />
        </Field>
        <Field label="Notiz">
          <textarea
            rows={2}
            value={form.notiz ?? ''}
            onChange={(e) => setForm({ ...form, notiz: e.target.value })}
            className={baseInputCls}
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">
          {isDirty ? '● Ungespeicherte Änderungen' : 'Keine Änderungen'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!isDirty || updateMut.isPending}
            onClick={() => {
              setForm({
                name: partner.name,
                parent_partner_id: partner.parent_partner_id,
                rechtsform_id: partner.rechtsform_id,
                branche_id: partner.branche_id,
                anrede_id: partner.anrede_id,
                titel: partner.titel,
                vorname: partner.vorname,
                nachname: partner.nachname,
                ust_id_nr: partner.ust_id_nr,
                steuer_nr: partner.steuer_nr,
                hrb: partner.hrb,
                website: partner.website,
                email: partner.email,
                telefon: partner.telefon,
                notiz: partner.notiz,
                typen: partner.typen,
              });
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Verwerfen
          </button>
          <button
            type="button"
            disabled={!isDirty || emailInvalid || updateMut.isPending}
            onClick={() => updateMut.mutate()}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {updateMut.isPending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      </div>
      {updateMut.error && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          <div className="font-semibold">Speichern fehlgeschlagen:</div>
          <div className="mt-0.5">{extractMutationError(updateMut.error)}</div>
        </div>
      )}
    </Section>
  );
}

const baseInputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}

// ============================================================================
// Hook: Dirty-Form-Warnung beim Seitenverlassen
// ============================================================================

function useDirtyFormWarning(isDirty: boolean) {
  // beforeunload für Browser-Tab/Reload
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // useBlocker für Router-Navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Ungespeicherte Änderungen"
      message="Du hast Änderungen, die noch nicht gespeichert sind. Wirklich verlassen?"
      tone="danger"
      confirmLabel="Verlassen"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}

// ============================================================================
// Sektion: Struktur — mit "+ Filiale anlegen"
// ============================================================================

function StrukturSection({
  partner,
  filialen,
  onOpenFiliale,
  partnerTypen,
}: {
  partner: PartnerRead;
  filialen: PartnerRead[];
  onOpenFiliale: (id: string) => void;
  partnerTypen: PartnerTyp[];
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Section
      title="Struktur"
      action={
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> Filiale
        </button>
      }
    >
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
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
          Filialen ({filialen.length})
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
                        deaktiviert
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

      {showCreate && (
        <FilialeAnlegenModal
          parentPartnerId={partner.id}
          parentTypen={partnerTypen}
          onClose={() => setShowCreate(false)}
        />
      )}
    </Section>
  );
}

function FilialeAnlegenModal({
  parentPartnerId,
  parentTypen,
  onClose,
}: {
  parentPartnerId: string;
  parentTypen: PartnerTyp[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const createMut = useMutation({
    mutationFn: () =>
      partnerApi.create({
        name: name.trim(),
        parent_partner_id: parentPartnerId,
        // Filiale erbt die Typen der Mutter — pragmatischer Default; Tim kann
        // sie auf der Filial-Detail-Seite anpassen.
        typen: parentTypen,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['partner-filialen', parentPartnerId] });
      onClose();
      navigate(`/stammdaten/partner/${created.id}`);
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
        className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Filiale anlegen</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Name *">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Filiale Frankfurt"
            className={baseInputCls}
          />
        </Field>

        <p className="mt-2 text-[10px] text-zinc-500">
          Die Filiale wird mit den Typen der Mutter angelegt. Adresse, Kontakte
          und weitere Stammdaten kannst du danach auf der Filial-Detailseite
          pflegen.
        </p>

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
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {createMut.isPending ? 'Lege an …' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
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
  const [deleteConfirm, setDeleteConfirm] = useState<PartnerKontaktRead | null>(
    null,
  );

  const deleteMut = useMutation({
    mutationFn: (kontaktId: string) => partnerApi.removeKontakt(kontaktId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partner.id] });
      setDeleteConfirm(null);
    },
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
                      deaktiviert
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
                <div className="mt-0.5 space-y-0.5 text-[11px] text-zinc-400">
                  {k.email && <div>✉ {k.email}</div>}
                  {k.telefon && <div>📞 {k.telefon}</div>}
                  {k.mobil && <div>📱 {k.mobil}</div>}
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
                  onClick={() => setDeleteConfirm(k)}
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

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Kontakt löschen?"
        message={
          deleteConfirm
            ? `Kontakt „${[deleteConfirm.titel, deleteConfirm.vorname, deleteConfirm.nachname].filter(Boolean).join(' ') || '—'}" wirklich löschen?`
            : ''
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={deleteMut.isPending}
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
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
  const [deleteConfirm, setDeleteConfirm] = useState<
    PartnerRead['adress_links'][number] | null
  >(null);

  const deleteMut = useMutation({
    mutationFn: (linkId: string) => partnerApi.removeAdresse(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', partner.id] });
      setDeleteConfirm(null);
    },
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
                  onClick={() => setDeleteConfirm(link)}
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

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Adresse vom Partner entfernen?"
        message="Die Verknüpfung wird gelöst. Die Adresse selbst bleibt in den Stammdaten."
        tone="danger"
        confirmLabel="Entfernen"
        busy={deleteMut.isPending}
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </Section>
  );
}

// ============================================================================
// Sektion: Verknüpfungen
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
        <CounterTile icon={Briefcase} label="Filialen" value={filialenCount} />
        <CounterTile icon={TicketIcon} label="Tickets" value={ticketsCount} />
        <CounterTile
          icon={Home}
          label="Objekt-Verknüpfungen"
          value="—"
          hint="kommt in einer späteren Phase"
        />
        <CounterTile icon={User} label="Kontakte" value={partner.kontakte.length} />
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
// Modal: Kontakt anlegen / bearbeiten — NEUER AUFBAU (R6c-Polish)
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
  const titelWerte = listen.get('titel')?.werte ?? [];
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
    // WICHTIG: EmailStr im Backend akzeptiert nur null oder gültige Email — nicht "".
    const payload: PartnerKontaktCreate = {
      ...form,
      titel: nullIfEmpty(form.titel),
      vorname: nullIfEmpty(form.vorname),
      nachname: nullIfEmpty(form.nachname),
      email: nullIfEmpty(form.email),
      telefon: nullIfEmpty(form.telefon),
      mobil: nullIfEmpty(form.mobil),
      notiz: nullIfEmpty(form.notiz),
    };
    if (initial) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const nameMissing = !nullIfEmpty(form.vorname) && !nullIfEmpty(form.nachname);
  const emailInvalid = !isValidEmailOrEmpty(form.email);
  const isInvalid = nameMissing || emailInvalid;
  const submitError = extractMutationError(
    createMut.error ?? updateMut.error,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-xl"
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

        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          <Field label="Anrede">
            <select
              value={form.anrede_id ?? ''}
              onChange={(e) =>
                setForm({ ...form, anrede_id: e.target.value || null })
              }
              className={baseInputCls}
            >
              <option value="">—</option>
              {anreden.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Titel">
            <select
              value={form.titel ?? ''}
              onChange={(e) =>
                setForm({ ...form, titel: e.target.value || null })
              }
              className={baseInputCls}
            >
              <option value="">—</option>
              {titelWerte.map((w) => (
                <option key={w.id} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vorname">
            <input
              type="text"
              value={form.vorname ?? ''}
              onChange={(e) => setForm({ ...form, vorname: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Nachname">
            <input
              type="text"
              value={form.nachname ?? ''}
              onChange={(e) => setForm({ ...form, nachname: e.target.value })}
              className={baseInputCls}
            />
          </Field>

          <Field label="Rollen (Mehrfachauswahl)">
            {rollenWerte.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Keine Rollen in der Auswahlliste — bitte Werte unter Stammdaten →
                Auswahllisten → „kontakt_rolle&ldquo; pflegen.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1 rounded-md border border-zinc-800 bg-zinc-950/30 p-2">
                {rollenWerte.map((r) => {
                  const active = (form.rollen ?? []).includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleRolle(r.id)}
                        className="accent-emerald-500"
                      />
                      {r.label}
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          {/* Untereinander — Tim R6c-Polish */}
          <Field label="E-Mail">
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Telefon">
            <input
              type="text"
              value={form.telefon ?? ''}
              onChange={(e) => setForm({ ...form, telefon: e.target.value })}
              className={baseInputCls}
            />
          </Field>
          <Field label="Mobil">
            <input
              type="text"
              value={form.mobil ?? ''}
              onChange={(e) => setForm({ ...form, mobil: e.target.value })}
              className={baseInputCls}
            />
          </Field>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={form.ist_hauptkontakt ?? false}
              onChange={(e) =>
                setForm({ ...form, ist_hauptkontakt: e.target.checked })
              }
              className="accent-emerald-500"
            />
            Als Hauptkontakt markieren
          </label>

          <Field label="Notiz">
            <textarea
              rows={2}
              value={form.notiz ?? ''}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              className={baseInputCls}
            />
          </Field>

          {nameMissing && (
            <p className="text-xs text-amber-400">
              Bitte mindestens Vorname oder Nachname angeben.
            </p>
          )}
          {emailInvalid && (
            <p className="text-xs text-amber-400">
              E-Mail-Adresse ist ungültig (muss ein @ enthalten oder leer sein).
            </p>
          )}
          {submitError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              <div className="font-semibold">Speichern fehlgeschlagen:</div>
              <div className="mt-0.5">{submitError}</div>
            </div>
          )}
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
            disabled={isPending || isInvalid}
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
// Modal: Adresse verknüpfen
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

          <Field label="Adress-Typ">
            <select
              value={typId}
              onChange={(e) => setTypId(e.target.value)}
              className={baseInputCls}
            >
              <option value="">— keiner —</option>
              {adresstypen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={istPrimaer}
              onChange={(e) => setIstPrimaer(e.target.checked)}
              className="accent-emerald-500"
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
