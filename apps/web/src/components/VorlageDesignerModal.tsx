import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { tickettypApi } from '../api/endpoints';
import type {
  TickettypCreate,
  TickettypFeldRead,
  TickettypFeldUpdate,
  TickettypRead,
  TickettypUpdate,
} from '../api/types';
import { FarbPicker } from './FarbPicker';
import { SymbolPicker } from './SymbolPicker';
import { VorlageFelderListe } from './VorlageFelderListe';
import { VorlagePreviewFelder } from './VorlagePreviewFelder';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

interface Props {
  /** Wenn null → Neuanlage, sonst Bearbeiten. */
  vorlage: TickettypRead | null;
  onClose: () => void;
  onSaved: (saved: TickettypRead) => void;
}

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

// Default-Felder für Live-Vorschau beim Anlegen einer neuen Vorlage.
// Muss synchron bleiben mit DEFAULT_SYSTEM_FELDER in
// apps/api/src/fm_api/services/tickettyp_service.py — Backend ist die
// Source-of-Truth und seedet die echten Datensätze.
// IDs sind Pseudo-Slugs (statt UUIDs), nur für React-Keys und
// DnD-Identifier; werden nach erfolgreichem Anlegen durch Backend-Werte
// ersetzt.
const DEFAULT_FELDER_PREVIEW: TickettypFeldRead[] = [
  { id: 'default-titel', feld_key: 'titel', label: 'Titel', ist_system_feld: true, sichtbar: true, pflicht: true, nur_admin_sichtbar: false, reihenfolge: 0 },
  { id: 'default-objekt', feld_key: 'objekt', label: 'Objekt', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 1 },
  { id: 'default-haus', feld_key: 'haus', label: 'Haus', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 2 },
  { id: 'default-stockwerk', feld_key: 'stockwerk', label: 'Stockwerk', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 3 },
  { id: 'default-einheit', feld_key: 'einheit', label: 'Einheit', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 4 },
  { id: 'default-anlage', feld_key: 'anlage', label: 'Anlage', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 5 },
  { id: 'default-partner', feld_key: 'partner', label: 'Partner', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 6 },
  { id: 'default-kategorie', feld_key: 'kategorie', label: 'Kategorie', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 7 },
  { id: 'default-prio', feld_key: 'prio', label: 'Priorität', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 8 },
  { id: 'default-pin', feld_key: 'pin', label: 'Foto-Pin', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 9 },
  { id: 'default-melder', feld_key: 'melder', label: 'Melder', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 10 },
  { id: 'default-quelle', feld_key: 'quelle', label: 'Eingangskanal', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 11 },
  { id: 'default-beschreibung', feld_key: 'beschreibung', label: 'Beschreibung', ist_system_feld: true, sichtbar: true, pflicht: true, nur_admin_sichtbar: false, reihenfolge: 12 },
  { id: 'default-foto', feld_key: 'foto', label: 'Foto', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 13 },
  { id: 'default-dokumente', feld_key: 'dokumente', label: 'Dokumente', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 14 },
  { id: 'default-projekt', feld_key: 'projekt', label: 'Projekt', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 15 },
  { id: 'default-faelligkeit_am', feld_key: 'faelligkeit_am', label: 'Fälligkeitsdatum', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 16 },
  { id: 'default-wiederholung', feld_key: 'wiederholung', label: 'Wiederholung', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 17 },
  { id: 'default-fehlercode', feld_key: 'fehlercode', label: 'Fehlercode', ist_system_feld: true, sichtbar: true, pflicht: false, nur_admin_sichtbar: false, reihenfolge: 18 },
];

export function VorlageDesignerModal({ vorlage, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const isNew = vorlage === null;

  const [form, setForm] = useState<DesignerForm>(() => ({
    key: vorlage?.key ?? '',
    label: vorlage?.label ?? '',
    beschreibung: vorlage?.beschreibung ?? '',
    icon: vorlage?.icon ?? 'wrench',
    farbe: vorlage?.farbe ?? 'emerald',
  }));
  const [felder, setFelder] = useState<TickettypFeldRead[]>(
    vorlage?.felder ?? DEFAULT_FELDER_PREVIEW,
  );
  const [keyTouched, setKeyTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  // Bei Neuanlage: Key automatisch aus Label slugifizieren, bis User ihn manuell ändert
  useEffect(() => {
    if (isNew && !keyTouched) {
      setForm((prev) => ({ ...prev, key: slugify(prev.label) }));
    }
  }, [form.label, isNew, keyTouched]);

  // ESC schließt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') tryClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, felder]);

  const dirty = useMemo(() => {
    if (isNew) return form.label.trim() !== '' || form.beschreibung.trim() !== '';
    if (!vorlage) return false;
    if (form.label !== vorlage.label) return true;
    if ((form.beschreibung || null) !== (vorlage.beschreibung || null)) return true;
    if (form.icon !== vorlage.icon) return true;
    if (form.farbe !== vorlage.farbe) return true;
    // Felder-Änderungen
    const orig = new Map(vorlage.felder.map((f) => [f.id, f]));
    for (const f of felder) {
      const o = orig.get(f.id);
      if (!o) return true;
      if (
        o.sichtbar !== f.sichtbar ||
        o.pflicht !== f.pflicht ||
        o.reihenfolge !== f.reihenfolge
      ) {
        return true;
      }
    }
    return false;
  }, [form, felder, vorlage, isNew]);

  function tryClose() {
    if (dirty) {
      setShowAbortConfirm(true);
    } else {
      onClose();
    }
  }

  const createMut = useMutation({
    mutationFn: (payload: TickettypCreate) => tickettypApi.create(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['tickettypen'] });
      onSaved(created);
    },
    onError: (err) => {
      setSubmitError(extractErrorMessage(err));
    },
  });

  const saveMut = useMutation({
    mutationFn: async (args: { id: string; meta: TickettypUpdate; felder: TickettypFeldUpdate[] }) => {
      await tickettypApi.update(args.id, args.meta);
      const updated = await tickettypApi.updateFelder(args.id, args.felder);
      return updated;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['tickettypen'] });
      onSaved(saved);
    },
    onError: (err) => {
      setSubmitError(extractErrorMessage(err));
    },
  });

  function handleSubmit() {
    setSubmitError(null);

    if (!form.label.trim()) {
      setSubmitError('Bezeichnung ist Pflicht.');
      return;
    }

    if (isNew) {
      if (!form.key.trim()) {
        setSubmitError('Key ist Pflicht.');
        return;
      }
      const payload: TickettypCreate = {
        key: form.key.trim(),
        label: form.label.trim(),
        beschreibung: form.beschreibung.trim() || null,
        icon: form.icon,
        farbe: form.farbe,
      };
      createMut.mutate(payload);
      return;
    }

    if (!vorlage) return;
    const metaUpdate: TickettypUpdate = {
      label: form.label.trim(),
      beschreibung: form.beschreibung.trim() || null,
      icon: form.icon,
      farbe: form.farbe,
    };
    const felderUpdate: TickettypFeldUpdate[] = felder.map((f) => ({
      feld_key: f.feld_key,
      sichtbar: f.sichtbar,
      pflicht: f.pflicht,
      reihenfolge: f.reihenfolge,
    }));
    saveMut.mutate({ id: vorlage.id, meta: metaUpdate, felder: felderUpdate });
  }

  const isPending = createMut.isPending || saveMut.isPending;

  // Synthetisches Tickettyp-Objekt für die Vorschau — nutzt aktuelle Designer-Werte
  const previewTickettyp = {
    label: form.label,
    beschreibung: form.beschreibung,
    icon: form.icon,
    farbe: form.farbe,
    felder,
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
        onClick={tryClose}
      >
        <div
          className="flex max-h-[92vh] w-full max-w-7xl flex-col rounded-xl bg-zinc-900 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-100">
              {isNew ? 'Neue Vorlage' : `Vorlage bearbeiten: ${vorlage?.label}`}
            </h2>
            <button
              type="button"
              onClick={tryClose}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
            {/* Designer (links) */}
            <div className="space-y-4 overflow-y-auto border-zinc-800 p-6 lg:border-r">
              <div>
                <label htmlFor="vd-label" className="block text-sm font-medium text-zinc-300">
                  Bezeichnung <span className="text-red-400">*</span>
                </label>
                <input
                  id="vd-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  autoFocus
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

              {!isNew && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-zinc-300">
                      Felder (Reihenfolge per Drag-and-Drop)
                    </label>
                    <span className="text-xs text-zinc-500">
                      {felder.filter((f) => f.sichtbar).length} sichtbar ·{' '}
                      {felder.filter((f) => f.sichtbar && f.pflicht).length} Pflicht
                    </span>
                  </div>
                  <VorlageFelderListe felder={felder} onChange={setFelder} />
                </div>
              )}

              {isNew && (
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                  Beim Anlegen werden 19 System-Felder mit Standard-Konfiguration erzeugt
                  (Titel + Beschreibung als Pflicht, Rest sichtbar und optional). Nach dem
                  Speichern kannst du Sichtbarkeit, Pflicht und Reihenfolge anpassen.
                </div>
              )}

              {submitError && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {submitError}
                </div>
              )}
            </div>

            {/* Live-Vorschau (rechts) */}
            <div className="overflow-y-auto bg-zinc-950/40 p-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live-Vorschau Erfassungs-Formular
              </div>
              <VorlagePreviewFelder tickettyp={previewTickettyp} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={tryClose}
              disabled={isPending}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
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
      </div>

      <ConfirmDialog
        open={showAbortConfirm}
        title="Änderungen verwerfen?"
        message="Du hast Änderungen gemacht, die noch nicht gespeichert sind. Wenn du jetzt schließt, gehen sie verloren."
        confirmLabel="Verwerfen"
        tone="primary"
        onConfirm={() => {
          setShowAbortConfirm(false);
          onClose();
        }}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </>
  );
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: string } } }).response;
    if (resp?.data?.detail) return resp.data.detail;
  }
  if (err instanceof Error) return err.message;
  return 'Speichern fehlgeschlagen.';
}
