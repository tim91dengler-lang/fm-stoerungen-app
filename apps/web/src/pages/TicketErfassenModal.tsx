import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, AlertOctagon } from 'lucide-react';
import clsx from 'clsx';
import {
  auswahllistenApi,
  fehlercodeApi,
  objektstrukturApi,
  ticketApi,
  tickettypApi,
  userApi,
} from '../api/endpoints';
import { aktiveWerte } from '../lib/aktiveWerte';
import { farbeClassHover } from '../components/TickettypFarbe';
import { iconFor } from '../components/TickettypIcon';
import { vorlageFelder } from '../lib/vorlageFelder';
import { GrundrissPin } from '../components/GrundrissPin';
import { EntitySearchSelect } from '../components/EntitySearchSelect';
import {
  loadProjektLabel,
  makeAnlageSearch,
  makeFehlercodeSearch,
  makeProjektSearch,
  searchObjekte,
  searchPartner,
} from '../lib/entitySearch';

// Schema lax — Pflichtfelder werden pro Vorlage validiert (siehe submit())
const schema = z.object({
  tickettyp_id: z.string().uuid().optional().nullable(),
  titel: z.string().max(200).optional().default(''),
  beschreibung: z.string().max(10_000).optional().default(''),
  prioritaet: z.enum(['niedrig', 'mittel', 'hoch', 'kritisch']).default('mittel'),
  kategorie: z.string().optional().nullable(),
  quelle: z.string().optional().nullable(),
  melder: z.string().max(200).optional().nullable(),
  objekt_id: z.string().uuid().optional().nullable(),
  haus_id: z.string().uuid().optional().nullable(),
  stockwerk_id: z.string().uuid().optional().nullable(),
  einheit_id: z.string().uuid().optional().nullable(),
  partner_id: z.string().uuid().optional().nullable(),
  projekt_id: z.string().uuid().optional().nullable(),
  anlage_id: z.string().uuid().optional().nullable(),
  fehlercode_id: z.string().uuid().optional().nullable(),
  zugewiesen_an_id: z.string().uuid().optional().nullable(),
  faelligkeit_am: z.string().optional().nullable(),
  wiederholung: z.string().optional().nullable(),
  pins: z
    .array(z.object({ x: z.number(), y: z.number(), label: z.string().nullable().optional() }))
    .default([]),
});

type Form = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onCreated: () => void;
  /** Pre-fill the projekt-Select when the modal is opened from a Projekt-Detail context. */
  defaultProjektId?: string | null;
}

export function TicketErfassenModal({
  onClose,
  onCreated,
  defaultProjektId = null,
}: Props) {
  const { data: tickettypen = [] } = useQuery({
    queryKey: ['tickettypen', 'aktiv_only'],
    queryFn: () => tickettypApi.list({ aktiv_only: true }),
    staleTime: 5 * 60_000,
  });
  const { data: users } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const kategorienListe = auswahllisten?.find((l) => l.key === 'ticket_kategorie');
  const quellenListe = auswahllisten?.find((l) => l.key === 'eingangskanal');

  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
    setValue,
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      tickettyp_id: null,
      titel: '',
      beschreibung: '',
      prioritaet: 'mittel',
      kategorie: null,
      quelle: 'manuell',
      melder: '',
      objekt_id: null,
      haus_id: null,
      stockwerk_id: null,
      einheit_id: null,
      partner_id: null,
      projekt_id: defaultProjektId,
      anlage_id: null,
      fehlercode_id: null,
      zugewiesen_an_id: null,
      faelligkeit_am: null,
      wiederholung: null,
      pins: [],
    },
  });

  const selectedTypId = watch('tickettyp_id');
  const selectedObjektId = watch('objekt_id');
  const selectedHausId = watch('haus_id');
  const selectedStockwerkId = watch('stockwerk_id');
  const selectedFehlercodeId = watch('fehlercode_id');
  const selectedAnlageId = watch('anlage_id');
  const selectedPartnerId = watch('partner_id');
  const selectedProjektId = watch('projekt_id');
  const pins = watch('pins');

  const selectedTyp = useMemo(
    () => tickettypen.find((t) => t.id === selectedTypId) ?? null,
    [tickettypen, selectedTypId],
  );
  const felder = useMemo(() => vorlageFelder(selectedTyp), [selectedTyp]);
  const feldSichtbar = felder.sichtbar;
  const feldPflicht = felder.pflicht;

  useEffect(() => {
    if (!selectedTypId && tickettypen.length > 0) {
      const def = tickettypen.find((t) => t.key === 'reparatur') ?? tickettypen[0];
      if (def) setValue('tickettyp_id', def.id);
    }
  }, [tickettypen, selectedTypId, setValue]);

  const { data: hausTree } = useQuery({
    queryKey: ['haus-tree', selectedObjektId],
    queryFn: () => objektstrukturApi.listHaus(selectedObjektId!),
    enabled: !!selectedObjektId,
    staleTime: 30_000,
  });

  const haus = useMemo(
    () => hausTree?.find((h) => h.id === selectedHausId) ?? null,
    [hausTree, selectedHausId],
  );
  const stockwerk = useMemo(
    () => haus?.stockwerke?.find((s) => s.id === selectedStockwerkId) ?? null,
    [haus, selectedStockwerkId],
  );

  // Fehlercode-Pre-Fill: nur Beschreibung übernehmen (Entscheidung Tim 2026-05-22).
  // Fehlercode wird einzeln nachgeladen (kein Vorab-Load mehr seit Such-Picker).
  useEffect(() => {
    if (!selectedFehlercodeId) return;
    let cancelled = false;
    fehlercodeApi
      .get(selectedFehlercodeId)
      .then((fc) => {
        if (!cancelled && fc.beschreibung) setValue('beschreibung', fc.beschreibung);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedFehlercodeId, setValue]);

  // Stockwerk-Wechsel: Pins zurücksetzen (anderer Grundriss).
  useEffect(() => {
    setValue('pins', []);
  }, [selectedStockwerkId, setValue]);

  const create = useMutation({
    mutationFn: (data: Form) =>
      ticketApi.create({
        tickettyp_id: data.tickettyp_id || null,
        titel: data.titel ?? '',
        beschreibung: data.beschreibung ?? '',
        prioritaet: data.prioritaet,
        kategorie: data.kategorie || null,
        quelle: data.quelle || null,
        melder: data.melder || null,
        objekt_id: data.objekt_id || null,
        haus_id: data.haus_id || null,
        stockwerk_id: data.stockwerk_id || null,
        einheit_id: data.einheit_id || null,
        partner_id: data.partner_id || null,
        projekt_id: data.projekt_id || null,
        anlage_id: data.anlage_id || null,
        fehlercode_id: data.fehlercode_id || null,
        zugewiesen_an_id: data.zugewiesen_an_id || null,
        faelligkeit_am: data.faelligkeit_am || null,
        wiederholung: data.wiederholung || null,
        pins: data.pins ?? [],
      }),
    onSuccess: () => onCreated(),
    onError: () => setError('root', { message: 'Anlegen fehlgeschlagen.' }),
  });

  function onSubmit(data: Form) {
    // Per-Vorlage Pflichtfeld-Validierung
    const pflichtChecks: Array<[string, string, string | null | undefined]> = [
      ['titel', 'Titel', data.titel],
      ['beschreibung', 'Beschreibung', data.beschreibung],
      ['objekt', 'Objekt', data.objekt_id],
      ['haus', 'Haus', data.haus_id],
      ['stockwerk', 'Stockwerk', data.stockwerk_id],
      ['einheit', 'Einheit', data.einheit_id],
      ['partner', 'Partner', data.partner_id],
      ['kategorie', 'Kategorie', data.kategorie],
      ['anlage', 'Anlage', data.anlage_id],
      ['fehlercode', 'Fehlercode', data.fehlercode_id],
      ['melder', 'Melder', data.melder],
      ['quelle', 'Quelle', data.quelle],
      ['projekt', 'Projekt', data.projekt_id],
      ['faelligkeit_am', 'Fälligkeit', data.faelligkeit_am],
    ];
    for (const [key, label, value] of pflichtChecks) {
      if (feldPflicht(key) && !value) {
        setSubmitError(`Pflichtfeld "${label}" laut Vorlage ist nicht gesetzt.`);
        return;
      }
    }
    setSubmitError(null);
    create.mutate(data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Neues Ticket</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 text-zinc-500 hover:bg-zinc-800 lg:min-h-0 lg:min-w-0"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tickettyp-Picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-300">Vorlage</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {tickettypen.map((t) => {
                const Icon = iconFor(t.icon);
                const selected = t.id === selectedTypId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setValue('tickettyp_id', t.id)}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                      selected
                        ? farbeClassHover(t.farbe) + ' ring-1 ring-emerald-400'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {feldSichtbar('fehlercode') && (
            <div>
              <label
                htmlFor="fehlercode_id"
                className="block text-sm font-medium text-zinc-300"
              >
                <AlertOctagon className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-amber-400" />
                Fehlercode {feldPflicht('fehlercode') && <span className="text-red-400">*</span>}
              </label>
              <div className="mt-1">
                <EntitySearchSelect
                  id="fehlercode_id"
                  value={selectedFehlercodeId ?? null}
                  onChange={(id) =>
                    setValue('fehlercode_id', id, { shouldDirty: true })
                  }
                  fetcher={makeFehlercodeSearch(selectedAnlageId)}
                  queryKey={`fehlercode-${selectedAnlageId ?? 'all'}`}
                  placeholder="Fehlercode suchen …"
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                Bei Auswahl wird die Beschreibung übernommen.
              </p>
            </div>
          )}

          {feldSichtbar('titel') && (
            <div>
              <label htmlFor="titel" className="block text-sm font-medium text-zinc-300">
                Titel {feldPflicht('titel') && <span className="text-red-400">*</span>}
              </label>
              <input
                id="titel"
                {...register('titel')}
                autoFocus
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder={
                  selectedTyp?.key === 'wartung'
                    ? 'z. B. Wartung Heizungsanlage Q2'
                    : 'Kurze Beschreibung des Problems'
                }
              />
              {errors.titel && (
                <p className="mt-1 text-xs text-red-400">{errors.titel.message}</p>
              )}
            </div>
          )}

          {feldSichtbar('beschreibung') && (
            <div>
              <label
                htmlFor="beschreibung"
                className="block text-sm font-medium text-zinc-300"
              >
                Beschreibung {feldPflicht('beschreibung') && <span className="text-red-400">*</span>}
              </label>
              <textarea
                id="beschreibung"
                rows={3}
                {...register('beschreibung')}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {feldSichtbar('prio') && (
              <div>
                <label htmlFor="prioritaet" className="block text-sm font-medium text-zinc-300">
                  Priorität
                </label>
                <select
                  id="prioritaet"
                  {...register('prioritaet')}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="niedrig">Niedrig</option>
                  <option value="mittel">Mittel</option>
                  <option value="hoch">Hoch</option>
                  <option value="kritisch">Kritisch</option>
                </select>
              </div>
            )}
            {feldSichtbar('kategorie') && (
              <div>
                <label htmlFor="kategorie" className="block text-sm font-medium text-zinc-300">
                  Kategorie {feldPflicht('kategorie') && <span className="text-red-400">*</span>}
                </label>
                <select
                  id="kategorie"
                  {...register('kategorie', { setValueAs: (v) => (v === '' ? null : v) })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="">— (keine) —</option>
                  {aktiveWerte(kategorienListe?.werte).map((w) => (
                    <option key={w.id} value={w.key}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {feldSichtbar('quelle') && (
              <div>
                <label htmlFor="quelle" className="block text-sm font-medium text-zinc-300">
                  Quelle
                </label>
                <select
                  id="quelle"
                  {...register('quelle', { setValueAs: (v) => (v === '' ? null : v) })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="">— (keine) —</option>
                  {aktiveWerte(quellenListe?.werte).map((w) => (
                    <option key={w.id} value={w.key}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {feldSichtbar('melder') && (
              <div>
                <label htmlFor="melder" className="block text-sm font-medium text-zinc-300">
                  Melder / Anrufer
                </label>
                <input
                  id="melder"
                  {...register('melder')}
                  placeholder="Name oder Telefonnummer"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
            )}
          </div>

          {/* Ort: Objekt -> Haus -> Stockwerk -> Einheit */}
          {(feldSichtbar('objekt') ||
            feldSichtbar('haus') ||
            feldSichtbar('stockwerk') ||
            feldSichtbar('einheit')) && (
            <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Ort
              </div>
              <div className="grid grid-cols-2 gap-3">
                {feldSichtbar('objekt') && (
                  <div>
                    <label htmlFor="objekt_id" className="block text-xs text-zinc-400">
                      Objekt {feldPflicht('objekt') && <span className="text-red-400">*</span>}
                    </label>
                    <div className="mt-1">
                      <EntitySearchSelect
                        id="objekt_id"
                        value={selectedObjektId ?? null}
                        onChange={(id) => {
                          setValue('objekt_id', id, { shouldDirty: true });
                          setValue('haus_id', null);
                          setValue('stockwerk_id', null);
                          setValue('einheit_id', null);
                        }}
                        fetcher={searchObjekte}
                        queryKey="objekt"
                        placeholder="Objekt suchen …"
                      />
                    </div>
                  </div>
                )}
                {feldSichtbar('haus') && (
                  <div>
                    <label htmlFor="haus_id" className="block text-xs text-zinc-400">
                      Haus
                    </label>
                    <select
                      id="haus_id"
                      disabled={!selectedObjektId}
                      {...register('haus_id', {
                        setValueAs: (v) => (v === '' ? null : v),
                        onChange: () => {
                          setValue('stockwerk_id', null);
                          setValue('einheit_id', null);
                        },
                      })}
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
                    >
                      <option value="">— (keins) —</option>
                      {hausTree?.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.bezeichnung}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {feldSichtbar('stockwerk') && (
                  <div>
                    <label htmlFor="stockwerk_id" className="block text-xs text-zinc-400">
                      Stockwerk
                    </label>
                    <select
                      id="stockwerk_id"
                      disabled={!selectedHausId}
                      {...register('stockwerk_id', {
                        setValueAs: (v) => (v === '' ? null : v),
                        onChange: () => setValue('einheit_id', null),
                      })}
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
                    >
                      <option value="">— (keins) —</option>
                      {haus?.stockwerke.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.bezeichnung}
                          {s.ausrichtung ? ` · ${s.ausrichtung}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {feldSichtbar('einheit') && (
                  <div>
                    <label htmlFor="einheit_id" className="block text-xs text-zinc-400">
                      Einheit
                    </label>
                    <select
                      id="einheit_id"
                      disabled={!selectedStockwerkId}
                      {...register('einheit_id', { setValueAs: (v) => (v === '' ? null : v) })}
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
                    >
                      <option value="">— (keine) —</option>
                      {stockwerk?.einheiten.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.bezeichnung}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {feldSichtbar('pin') && selectedStockwerkId && stockwerk?.has_grundriss && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-zinc-400">
                    Lage im Grundriss (optional, mehrere möglich)
                  </div>
                  <GrundrissPin
                    stockwerkId={selectedStockwerkId}
                    pins={pins ?? []}
                    onChange={(p) => setValue('pins', p)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {feldSichtbar('anlage') && (
              <div>
                <label htmlFor="anlage_id" className="block text-sm font-medium text-zinc-300">
                  <Activity className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-emerald-400" />
                  Anlage {feldPflicht('anlage') && <span className="text-red-400">*</span>}
                </label>
                <div className="mt-1">
                  <EntitySearchSelect
                    id="anlage_id"
                    value={selectedAnlageId ?? null}
                    onChange={(id) => setValue('anlage_id', id, { shouldDirty: true })}
                    fetcher={makeAnlageSearch(selectedObjektId)}
                    queryKey={`anlage-${selectedObjektId ?? 'all'}`}
                    placeholder="Anlage suchen …"
                  />
                </div>
              </div>
            )}
            {feldSichtbar('partner') && (
              <div>
                <label htmlFor="partner_id" className="block text-sm font-medium text-zinc-300">
                  Partner {feldPflicht('partner') && <span className="text-red-400">*</span>}
                </label>
                <div className="mt-1">
                  <EntitySearchSelect
                    id="partner_id"
                    value={selectedPartnerId ?? null}
                    onChange={(id) => setValue('partner_id', id, { shouldDirty: true })}
                    fetcher={searchPartner}
                    queryKey="partner"
                    placeholder="Geschäftspartner suchen …"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {feldSichtbar('projekt') && (
              <div>
                <label htmlFor="projekt_id" className="block text-sm font-medium text-zinc-300">
                  Projekt
                </label>
                <div className="mt-1">
                  <EntitySearchSelect
                    id="projekt_id"
                    value={selectedProjektId ?? null}
                    onChange={(id) => setValue('projekt_id', id, { shouldDirty: true })}
                    fetcher={makeProjektSearch(['geplant', 'aktiv'])}
                    loadLabel={loadProjektLabel}
                    queryKey="projekt"
                    placeholder="Projekt suchen …"
                  />
                </div>
              </div>
            )}
            <div>
              <label
                htmlFor="zugewiesen_an_id"
                className="block text-sm font-medium text-zinc-300"
              >
                Zugewiesen an
              </label>
              <select
                id="zugewiesen_an_id"
                {...register('zugewiesen_an_id', { setValueAs: (v) => (v === '' ? null : v) })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="">— (offen) —</option>
                {users?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feldSichtbar('faelligkeit_am') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="faelligkeit_am"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Fälligkeit{' '}
                  {feldPflicht('faelligkeit_am') && <span className="text-red-400">*</span>}
                </label>
                <input
                  id="faelligkeit_am"
                  type="date"
                  {...register('faelligkeit_am')}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              {feldSichtbar('wiederholung') && (
                <div>
                  <label
                    htmlFor="wiederholung"
                    className="block text-sm font-medium text-zinc-300"
                  >
                    Wiederholung
                  </label>
                  <select
                    id="wiederholung"
                    {...register('wiederholung', { setValueAs: (v) => (v === '' ? null : v) })}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option value="">— (keine) —</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Quartalsweise</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {(errors.root || submitError) && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {submitError ?? errors.root?.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 lg:min-h-0"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || create.isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 lg:min-h-0"
            >
              {isSubmitting || create.isPending ? 'Wird angelegt …' : 'Anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
