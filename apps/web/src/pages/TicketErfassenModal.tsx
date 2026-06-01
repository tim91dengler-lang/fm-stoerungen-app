import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  auswahllistenApi,
  fehlercodeApi,
  objektApi,
  objektstrukturApi,
  ticketApi,
  tickettypApi,
  userApi,
} from '../api/endpoints';
import { aktiveWerte } from '../lib/aktiveWerte';
import { farbeClassHover } from '../components/TickettypFarbe';
import { iconFor } from '../components/TickettypIcon';
import { vorlageFelder } from '../lib/vorlageFelder';
import type { AdresseRead } from '../api/types';
import type { TicketBeteiligterWrite } from '../api/types';
import { buildVorlageLayout } from '../lib/vorlageLayout';
import { TicketFormEngine } from '../components/ticket/TicketFormEngine';
import {
  renderCreateFeld,
  type CreateFieldCtx,
} from '../components/ticket/createFieldRenderers';

// Schema lax — Pflichtfelder werden pro Vorlage validiert (siehe submit())
const schema = z.object({
  tickettyp_id: z.string().uuid().optional().nullable(),
  titel: z.string().max(200).optional().default(''),
  beschreibung: z.string().max(10_000).optional().default(''),
  prioritaet: z.enum(['niedrig', 'mittel', 'hoch', 'kritisch']).default('mittel'),
  kategorie: z.string().optional().nullable(),
  quelle: z.string().optional().nullable(),
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
    .array(
      z.object({ x: z.number(), y: z.number(), label: z.string().nullable().optional() }),
    )
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
  const beteiligtenRolleListe = auswahllisten?.find((l) => l.key === 'beteiligten_rolle');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [beteiligte, setBeteiligte] = useState<TicketBeteiligterWrite[]>([]);
  const [adresseId, setAdresseId] = useState<string | null>(null);
  const [selectedAdresse, setSelectedAdresse] = useState<AdresseRead | null>(null);

  const {
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

  const selectedTyp = useMemo(
    () => tickettypen.find((t) => t.id === selectedTypId) ?? null,
    [tickettypen, selectedTypId],
  );
  const felder = useMemo(() => vorlageFelder(selectedTyp), [selectedTyp]);
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
  // Objekt-Adresse als Default-Vorschau (solange keine eigene Adresse gesetzt).
  const { data: objektDetail } = useQuery({
    queryKey: ['objekt-adresse', selectedObjektId],
    queryFn: () => objektApi.get(selectedObjektId!),
    enabled: !!selectedObjektId && !adresseId,
    staleTime: 60_000,
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
        objekt_id: data.objekt_id || null,
        adresse_id: adresseId,
        haus_id: data.haus_id || null,
        stockwerk_id: data.stockwerk_id || null,
        einheit_id: data.einheit_id || null,
        // Legacy-Einzelfeld aus Hauptkontakt (sonst erstem Beteiligten) ableiten.
        partner_id:
          beteiligte.find((b) => b.ist_hauptkontakt)?.partner_id ??
          beteiligte[0]?.partner_id ??
          null,
        beteiligte,
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
      ['partner', 'Partner / Beteiligte', beteiligte.length > 0 ? 'ok' : null],
      ['kategorie', 'Kategorie', data.kategorie],
      ['anlage', 'Anlage', data.anlage_id],
      ['fehlercode', 'Fehlercode', data.fehlercode_id],
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

  // Stufe C (Flag): datengetriebenes Rendern der Felder aus den Blöcken.
  const fv = watch();
  const createCtx: CreateFieldCtx = {
    felder,
    values: {
      titel: fv.titel ?? '',
      beschreibung: fv.beschreibung ?? '',
      prioritaet: fv.prioritaet ?? 'mittel',
      kategorie: fv.kategorie ?? null,
      quelle: fv.quelle ?? null,
      wiederholung: fv.wiederholung ?? null,
      faelligkeit_am: fv.faelligkeit_am ?? null,
      objekt_id: fv.objekt_id ?? null,
      haus_id: fv.haus_id ?? null,
      stockwerk_id: fv.stockwerk_id ?? null,
      einheit_id: fv.einheit_id ?? null,
      anlage_id: fv.anlage_id ?? null,
      fehlercode_id: fv.fehlercode_id ?? null,
      projekt_id: fv.projekt_id ?? null,
      zugewiesen_an_id: fv.zugewiesen_an_id ?? null,
      pins: fv.pins ?? [],
    },
    setField: (name, value) =>
      setValue(name as Parameters<typeof setValue>[0], value as never, {
        shouldDirty: true,
      }),
    beteiligte,
    setBeteiligte,
    adresseId,
    selectedAdresse,
    objektDetail: objektDetail ?? null,
    onAdresse: (id, a) => {
      setAdresseId(id);
      setSelectedAdresse(a);
    },
    hausTree,
    kategorienListe,
    quellenListe,
    users: users?.items,
    beteiligtenRolleOptions: aktiveWerte(beteiligtenRolleListe?.werte).map((w) => ({
      key: w.key,
      label: w.label,
    })),
    grundrissStockwerk: stockwerk ?? undefined,
  };
  const layout = buildVorlageLayout(selectedTyp ?? null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-zinc-900 p-6 shadow-xl"
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

            <div className="lg:flex lg:gap-0">
              <TicketFormEngine
                layout={layout}
                renderFeld={(feld) => renderCreateFeld(feld.feld_key, createCtx)}
              />
            </div>

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
