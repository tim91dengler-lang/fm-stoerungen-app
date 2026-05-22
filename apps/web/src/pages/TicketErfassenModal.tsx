import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Wrench, Calendar, Binoculars } from 'lucide-react';
import clsx from 'clsx';
import {
  auswahllistenApi,
  objektApi,
  objektstrukturApi,
  partnerApi,
  projektApi,
  ticketApi,
  tickettypApi,
  userApi,
} from '../api/endpoints';

const schema = z.object({
  tickettyp_id: z.string().uuid().optional().nullable(),
  titel: z.string().min(1, 'Titel fehlt').max(200),
  beschreibung: z.string().max(10_000).optional().default(''),
  prioritaet: z
    .enum(['niedrig', 'mittel', 'hoch', 'kritisch'])
    .default('mittel'),
  kategorie: z.string().optional().nullable(),
  quelle: z.string().optional().nullable(),
  melder: z.string().max(200).optional().nullable(),
  objekt_id: z.string().uuid().optional().nullable(),
  haus_id: z.string().uuid().optional().nullable(),
  stockwerk_id: z.string().uuid().optional().nullable(),
  einheit_id: z.string().uuid().optional().nullable(),
  partner_id: z.string().uuid().optional().nullable(),
  projekt_id: z.string().uuid().optional().nullable(),
  zugewiesen_an_id: z.string().uuid().optional().nullable(),
  faelligkeit_am: z.string().optional().nullable(),
});

type Form = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const TYP_ICONS = {
  wrench: Wrench,
  calendar: Calendar,
  binoculars: Binoculars,
} as const;

function typIcon(key: string | null | undefined) {
  if (key && key in TYP_ICONS) return TYP_ICONS[key as keyof typeof TYP_ICONS];
  return Wrench;
}

function colorClasses(farbe: string | null | undefined): string {
  switch (farbe) {
    case 'emerald':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20';
    case 'blue':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20';
    case 'amber':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20';
    default:
      return 'border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800';
  }
}

export function TicketErfassenModal({ onClose, onCreated }: Props) {
  const { data: tickettypen = [] } = useQuery({
    queryKey: ['tickettypen'],
    queryFn: () => tickettypApi.list(),
    staleTime: 5 * 60_000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: objekte } = useQuery({
    queryKey: ['objekte-for-ticket'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const { data: partnerListe } = useQuery({
    queryKey: ['partner-for-ticket'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const { data: projekte } = useQuery({
    queryKey: ['projekte-active'],
    queryFn: () => projektApi.list({ status: ['geplant', 'laufend'] }),
    staleTime: 60_000,
  });

  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });

  const kategorienListe = auswahllisten?.find((l) => l.key === 'ticket_kategorie');
  const quellenListe = auswahllisten?.find((l) => l.key === 'eingangskanal');

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
      projekt_id: null,
      zugewiesen_an_id: null,
      faelligkeit_am: null,
    },
  });

  const selectedTypId = watch('tickettyp_id');
  const selectedObjektId = watch('objekt_id');
  const selectedHausId = watch('haus_id');
  const selectedStockwerkId = watch('stockwerk_id');

  const selectedTyp = useMemo(
    () => tickettypen.find((t) => t.id === selectedTypId) ?? null,
    [tickettypen, selectedTypId],
  );

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

  const showFaelligkeit =
    selectedTyp &&
    (selectedTyp.key === 'wartung' ||
      selectedTyp.key === 'baubegehung' ||
      (selectedTyp.pflichtfelder ?? []).includes('faelligkeit_am'));

  const create = useMutation({
    mutationFn: (data: Form) =>
      ticketApi.create({
        tickettyp_id: data.tickettyp_id || null,
        titel: data.titel,
        beschreibung: data.beschreibung,
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
        zugewiesen_an_id: data.zugewiesen_an_id || null,
        faelligkeit_am: data.faelligkeit_am || null,
      }),
    onSuccess: () => onCreated(),
    onError: () => setError('root', { message: 'Anlegen fehlgeschlagen.' }),
  });

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
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => create.mutate(data))} className="space-y-4">
          {/* Tickettyp-Picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-300">Tickettyp</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {tickettypen.map((t) => {
                const Icon = typIcon(t.icon);
                const selected = t.id === selectedTypId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setValue('tickettyp_id', t.id)}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                      selected
                        ? colorClasses(t.farbe) + ' ring-1 ring-emerald-400'
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

          <div>
            <label htmlFor="titel" className="block text-sm font-medium text-zinc-300">
              Titel <span className="text-red-400">*</span>
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
            {errors.titel && <p className="mt-1 text-xs text-red-400">{errors.titel.message}</p>}
          </div>

          <div>
            <label htmlFor="beschreibung" className="block text-sm font-medium text-zinc-300">
              Beschreibung
            </label>
            <textarea
              id="beschreibung"
              rows={3}
              {...register('beschreibung')}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label htmlFor="kategorie" className="block text-sm font-medium text-zinc-300">
                Kategorie
              </label>
              <select
                id="kategorie"
                {...register('kategorie', { setValueAs: (v) => (v === '' ? null : v) })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="">— (keine) —</option>
                {kategorienListe?.werte.map((w) => (
                  <option key={w.id} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quelle" className="block text-sm font-medium text-zinc-300">
                Quelle / Eingangskanal
              </label>
              <select
                id="quelle"
                {...register('quelle', { setValueAs: (v) => (v === '' ? null : v) })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="">— (keine) —</option>
                {quellenListe?.werte.map((w) => (
                  <option key={w.id} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
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
          </div>

          {/* Ort: Objekt -> Haus -> Stockwerk -> Einheit */}
          <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Ort
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="objekt_id" className="block text-xs text-zinc-400">
                  Objekt
                </label>
                <select
                  id="objekt_id"
                  {...register('objekt_id', {
                    setValueAs: (v) => (v === '' ? null : v),
                    onChange: () => {
                      setValue('haus_id', null);
                      setValue('stockwerk_id', null);
                      setValue('einheit_id', null);
                    },
                  })}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="">— (keins) —</option>
                  {objekte?.items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="partner_id" className="block text-sm font-medium text-zinc-300">
                Partner (Auftraggeber/Mieter)
              </label>
              <select
                id="partner_id"
                {...register('partner_id', { setValueAs: (v) => (v === '' ? null : v) })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="">— (keiner) —</option>
                {partnerListe?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="projekt_id" className="block text-sm font-medium text-zinc-300">
                Projekt
              </label>
              <select
                id="projekt_id"
                {...register('projekt_id', { setValueAs: (v) => (v === '' ? null : v) })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="">— (keins) —</option>
                {projekte?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="zugewiesen_an_id" className="block text-sm font-medium text-zinc-300">
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
            {showFaelligkeit && (
              <div>
                <label htmlFor="faelligkeit_am" className="block text-sm font-medium text-zinc-300">
                  Fälligkeit
                  {(selectedTyp?.pflichtfelder ?? []).includes('faelligkeit_am') && (
                    <span className="text-red-400"> *</span>
                  )}
                </label>
                <input
                  id="faelligkeit_am"
                  type="date"
                  {...register('faelligkeit_am')}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
            )}
          </div>

          {errors.root && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errors.root.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || create.isPending}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              {isSubmitting || create.isPending ? 'Wird angelegt …' : 'Anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
