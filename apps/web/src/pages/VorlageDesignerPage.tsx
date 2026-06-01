import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { tickettypApi } from '../api/endpoints';
import type {
  TickettypCreate,
  TickettypFeldRead,
  TickettypFeldUpdate,
  TickettypUpdate,
} from '../api/types';
import { FarbPicker } from '../components/FarbPicker';
import { SymbolPicker } from '../components/SymbolPicker';
import { VorlagenPool } from '../components/VorlagenPool';
import {
  type FeldUpdate,
  VorlagePreviewFelder,
} from '../components/VorlagePreviewFelder';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

interface DesignerForm {
  key: string;
  label: string;
  beschreibung: string;
  icon: string | null;
  farbe: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// Default-Felder für den Anlege-Modus. Muss synchron bleiben zu
// DEFAULT_SYSTEM_FELDER im Backend (tickettyp_service.py). Ist die
// Quelle für das, was der User beim Anlegen direkt konfigurieren kann.
// IDs sind Pseudo-Slugs (werden nach Speichern durch echte UUIDs ersetzt).
const DEFAULT_FELDER_PREVIEW: TickettypFeldRead[] = [
  { id: 'default-titel', feld_key: 'titel', label: 'Titel', ist_system_feld: true, sichtbar: true, pflicht: true, nur_admin_sichtbar: false, reihenfolge: 0 },
  { id: 'default-objekt', feld_key: 'objekt', label: 'Objekt', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 1 },
  { id: 'default-haus', feld_key: 'haus', label: 'Haus', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 2 },
  { id: 'default-stockwerk', feld_key: 'stockwerk', label: 'Stockwerk', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 3 },
  { id: 'default-einheit', feld_key: 'einheit', label: 'Einheit', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 4 },
  { id: 'default-anlage', feld_key: 'anlage', label: 'Anlage', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 5 },
  { id: 'default-partner', feld_key: 'partner', label: 'Beteiligte', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 6 },
  { id: 'default-kategorie', feld_key: 'kategorie', label: 'Kategorie', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 7 },
  { id: 'default-prio', feld_key: 'prio', label: 'Priorität', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 8 },
  { id: 'default-pin', feld_key: 'pin', label: 'Foto-Pin', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 9 },
  { id: 'default-quelle', feld_key: 'quelle', label: 'Eingangskanal', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 11 },
  { id: 'default-beschreibung', feld_key: 'beschreibung', label: 'Beschreibung', ist_system_feld: true, sichtbar: true, pflicht: true, nur_admin_sichtbar: false, reihenfolge: 12 },
  { id: 'default-foto', feld_key: 'foto', label: 'Foto', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 13 },
  { id: 'default-dokumente', feld_key: 'dokumente', label: 'Dokumente', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 14 },
  { id: 'default-projekt', feld_key: 'projekt', label: 'Projekt', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 15 },
  { id: 'default-faelligkeit_am', feld_key: 'faelligkeit_am', label: 'Fälligkeitsdatum', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 16 },
  { id: 'default-wiederholung', feld_key: 'wiederholung', label: 'Wiederholung', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 17 },
  { id: 'default-fehlercode', feld_key: 'fehlercode', label: 'Fehlercode', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 18 },
  { id: 'default-adresse', feld_key: 'adresse', label: 'Adresse', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 19 },
];

export function VorlageDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === undefined;

  const vorlageQuery = useQuery({
    queryKey: ['tickettyp', id],
    queryFn: () => tickettypApi.get(id!),
    enabled: !isNew,
  });

  const vorlage = vorlageQuery.data ?? null;

  const [form, setForm] = useState<DesignerForm>(() => ({
    key: '',
    label: '',
    beschreibung: '',
    icon: 'wrench',
    farbe: 'emerald',
  }));
  const [felder, setFelder] = useState<TickettypFeldRead[]>(DEFAULT_FELDER_PREVIEW);
  const [keyTouched, setKeyTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Beim ersten Laden des Edit-Modus: Form aus geladener Vorlage befüllen
  useEffect(() => {
    if (initialized || isNew) return;
    if (!vorlage) return;
    setForm({
      key: vorlage.key,
      label: vorlage.label,
      beschreibung: vorlage.beschreibung ?? '',
      icon: vorlage.icon ?? 'wrench',
      farbe: vorlage.farbe ?? 'emerald',
    });
    setFelder(vorlage.felder);
    setInitialized(true);
  }, [initialized, isNew, vorlage]);

  // Im Anlege-Modus: Key aus Label slugifizieren, bis User ihn anpasst
  useEffect(() => {
    if (isNew && !keyTouched) {
      setForm((prev) => ({ ...prev, key: slugify(prev.label) }));
    }
  }, [form.label, isNew, keyTouched]);

  const dirty = useMemo(() => {
    if (isNew) {
      // Alles als geändert betrachten, sobald Label nicht leer oder
      // Felder-Settings vom Default abweichen
      if (form.label.trim() !== '' || form.beschreibung.trim() !== '') return true;
      return !areFelderEqual(felder, DEFAULT_FELDER_PREVIEW);
    }
    if (!vorlage) return false;
    if (form.label !== vorlage.label) return true;
    if ((form.beschreibung || null) !== (vorlage.beschreibung || null)) return true;
    if (form.icon !== vorlage.icon) return true;
    if (form.farbe !== vorlage.farbe) return true;
    return !areFelderEqual(felder, vorlage.felder);
  }, [form, felder, vorlage, isNew]);

  // Browser-Back / Link-Navigation bei unsaved abfangen
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) return false;
    return currentLocation.pathname !== nextLocation.pathname;
  });

  // Beim Schließen des Tabs / Page-Reload warnen
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const updateFeld = useCallback((feldKey: string, update: FeldUpdate) => {
    setFelder((prev) => prev.map((f) => (f.feld_key === feldKey ? { ...f, ...update } : f)));
  }, []);

  const showFeld = useCallback(
    (feldKey: string) => {
      setFelder((prev) => {
        // Höchste sichtbare reihenfolge ermitteln, neues Feld dahinter einsortieren
        const maxVisible = Math.max(
          -1,
          ...prev.filter((f) => f.sichtbar).map((f) => f.reihenfolge),
        );
        return prev.map((f) => {
          if (f.feld_key !== feldKey) return f;
          return { ...f, sichtbar: true, reihenfolge: maxVisible + 1 };
        });
      });
    },
    [],
  );

  const versteckte = useMemo(
    () =>
      [...felder].filter((f) => !f.sichtbar).sort((a, b) => a.label.localeCompare(b.label)),
    [felder],
  );

  const createMut = useMutation({
    mutationFn: async (args: { payload: TickettypCreate; felder: TickettypFeldUpdate[] }) => {
      const created = await tickettypApi.create(args.payload);
      // Felder-Konfig nur dann patchen, wenn vom Backend-Default abweichend
      const hasNonDefault = args.felder.some((f) => {
        const def = DEFAULT_FELDER_PREVIEW.find((d) => d.feld_key === f.feld_key);
        if (!def) return true;
        return (
          f.sichtbar !== def.sichtbar ||
          f.pflicht !== def.pflicht ||
          f.reihenfolge !== def.reihenfolge ||
          (f.label && f.label !== def.label)
        );
      });
      if (!hasNonDefault) return created;
      try {
        return await tickettypApi.updateFelder(created.id, args.felder);
      } catch (err) {
        // Rollback: gerade angelegte Vorlage wieder löschen, damit der
        // User auf "Neu anlegen" konsistent erneut probieren kann.
        await tickettypApi.remove(created.id).catch(() => {});
        throw err;
      }
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['tickettypen'] });
      setInitialized(false); // damit useEffect die geladenen Felder übernimmt
      navigate(`/stammdaten/vorlagen/${created.id}/bearbeiten`, { replace: true });
    },
    onError: (err) => setSubmitError(extractErrorMessage(err)),
  });

  const saveMut = useMutation({
    mutationFn: async (args: {
      id: string;
      meta: TickettypUpdate;
      felder: TickettypFeldUpdate[];
    }) => {
      await tickettypApi.update(args.id, args.meta);
      return tickettypApi.updateFelder(args.id, args.felder);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['tickettypen'] });
      qc.invalidateQueries({ queryKey: ['tickettyp', saved.id] });
    },
    onError: (err) => setSubmitError(extractErrorMessage(err)),
  });

  function handleSubmit() {
    setSubmitError(null);

    if (!form.label.trim()) {
      setSubmitError('Bezeichnung ist Pflicht.');
      return;
    }

    const felderPayload: TickettypFeldUpdate[] = felder.map((f) => ({
      feld_key: f.feld_key,
      label: f.label,
      sichtbar: f.sichtbar,
      pflicht: f.pflicht,
      reihenfolge: f.reihenfolge,
    }));

    if (isNew) {
      if (!form.key.trim()) {
        setSubmitError('Key ist Pflicht.');
        return;
      }
      createMut.mutate({
        payload: {
          key: form.key.trim(),
          label: form.label.trim(),
          beschreibung: form.beschreibung.trim() || null,
          icon: form.icon,
          farbe: form.farbe,
        },
        felder: felderPayload,
      });
      return;
    }

    if (!vorlage) return;
    saveMut.mutate({
      id: vorlage.id,
      meta: {
        label: form.label.trim(),
        beschreibung: form.beschreibung.trim() || null,
        icon: form.icon,
        farbe: form.farbe,
      },
      felder: felderPayload,
    });
  }

  const isPending = createMut.isPending || saveMut.isPending;

  const previewTickettyp = {
    label: form.label,
    beschreibung: form.beschreibung,
    icon: form.icon,
    farbe: form.farbe,
    felder,
  };

  if (!isNew && vorlageQuery.isLoading) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <div className="text-sm text-zinc-500">Lade Vorlage …</div>
      </div>
    );
  }
  if (!isNew && vorlageQuery.isError) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Vorlage nicht gefunden.{' '}
          <Link to="/stammdaten/vorlagen" className="underline">
            Zurück zur Liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4 lg:px-8">
        <div className="min-w-0">
          <Link
            to="/stammdaten/vorlagen"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ChevronLeft className="h-3 w-3" /> Vorlagen
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold text-zinc-100">
            {isNew ? 'Neue Vorlage' : `Vorlage bearbeiten: ${vorlage?.label ?? ''}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/stammdaten/vorlagen')}
            disabled={isPending}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !dirty}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-medium',
              'bg-emerald-500 text-zinc-950 hover:bg-emerald-400',
              'disabled:bg-zinc-700 disabled:text-zinc-500',
            )}
          >
            {isPending ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8">
        {/* Stammdaten */}
        <section className="grid grid-cols-1 gap-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label htmlFor="vd-label" className="block text-sm font-medium text-zinc-300">
                Bezeichnung <span className="text-red-400">*</span>
              </label>
              <input
                id="vd-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                autoFocus={isNew}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="z. B. Wartung"
              />
            </div>

            {isNew && (
              <div>
                <label htmlFor="vd-key" className="block text-sm font-medium text-zinc-300">
                  Key <span className="text-red-400">*</span>
                </label>
                <input
                  id="vd-key"
                  value={form.key}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setForm({ ...form, key: slugify(e.target.value) });
                  }}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  placeholder="z-b-wartung"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Stabiler technischer Identifier — kann später nicht mehr geändert werden.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="vd-beschreibung" className="block text-sm font-medium text-zinc-300">
                Beschreibung
              </label>
              <textarea
                id="vd-beschreibung"
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="Wozu wird diese Vorlage genutzt?"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-300">Farbe</label>
              <div className="mt-2">
                <FarbPicker
                  value={form.farbe}
                  onChange={(slug) => setForm({ ...form, farbe: slug })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300">Symbol</label>
              <div className="mt-2">
                <SymbolPicker
                  value={form.icon}
                  onChange={(slug) => setForm({ ...form, icon: slug })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pool + Vorschau */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
          {/* Versteckte Felder */}
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Versteckte Felder</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Diese Felder erscheinen nicht im Erfassungs-Formular. Klick auf {'„+"'}, um sie einzublenden.
              </p>
            </div>
            <VorlagenPool felder={versteckte} onShow={showFeld} />
          </div>

          {/* Live-Vorschau */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live-Vorschau Erfassungs-Formular
              </h2>
              <div className="text-[11px] text-zinc-500">
                {felder.filter((f) => f.sichtbar).length} sichtbar ·{' '}
                {felder.filter((f) => f.sichtbar && f.pflicht).length} Pflicht
              </div>
            </div>
            <VorlagePreviewFelder
              tickettyp={previewTickettyp}
              onReorder={setFelder}
              onUpdateFeld={updateFeld}
            />
            <p className="mt-3 text-[10px] text-zinc-500">
              Tipp: Karten per Drag-and-Drop sortieren. Hover über eine Karte → Pflicht-Toggle
              (★) oder Verbergen (×). Klick aufs Label zum Umbenennen.
            </p>
          </div>
        </section>

        {submitError && (
          <div className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {submitError}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Änderungen verwerfen?"
        message="Du hast Änderungen gemacht, die noch nicht gespeichert sind. Wenn du diese Seite verlässt, gehen sie verloren."
        confirmLabel="Verwerfen"
        tone="primary"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}

function areFelderEqual(a: TickettypFeldRead[], b: TickettypFeldRead[]): boolean {
  if (a.length !== b.length) return false;
  const byKey = new Map(b.map((f) => [f.feld_key, f]));
  for (const f of a) {
    const o = byKey.get(f.feld_key);
    if (!o) return false;
    if (
      o.sichtbar !== f.sichtbar ||
      o.pflicht !== f.pflicht ||
      o.reihenfolge !== f.reihenfolge ||
      o.label !== f.label
    ) {
      return false;
    }
  }
  return true;
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: string } } }).response;
    if (resp?.data?.detail) return resp.data.detail;
  }
  if (err instanceof Error) return err.message;
  return 'Speichern fehlgeschlagen.';
}
