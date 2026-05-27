import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type {
  AuswahllisteRead,
  PartnerKontaktCreate,
  PartnerKontaktRead,
} from '../../api/types';
import { MultiSelectCombobox } from '../../components/MultiSelectCombobox';
import {
  extractMutationError,
  isValidEmailOrEmpty,
  nullIfEmpty,
} from './helpers';

interface Props {
  partnerId: string;
  listen: Map<string, AuswahllisteRead>;
  initial: PartnerKontaktRead | null;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none';

/**
 * Modal: Kontakt anlegen / bearbeiten (Spec §5.1).
 *
 * Layout (Polish 2026-05-26): flex-col mit max-h-screen, scrollbarer Body,
 * sticky Footer mit Buttons — verhindert dass Speichern/Abbrechen unter
 * dem Viewport verschwindet bei vielen Feldern / kleiner Bildhöhe.
 *
 * Rollen-Auswahl: Multi-Select-Combobox (Track 3 Polish: Tim wollte
 * Dropdown statt Checkbox-Grid).
 */
export function KontaktModal({ partnerId, listen, initial, onClose }: Props) {
  const qc = useQueryClient();
  const anreden = listen.get('anrede')?.werte ?? [];
  const titelWerte = listen.get('titel')?.werte ?? [];
  const rollenWerte = listen.get('kontakt_rolle')?.werte ?? [];
  const rollenOptions = rollenWerte.map((r) => ({ value: r.id, label: r.label }));

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
      : { rollen: [], ist_hauptkontakt: false, gesperrt: false },
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

  function handleSubmit() {
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
  const submitError = extractMutationError(createMut.error ?? updateMut.error);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            {initial ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollbarer Body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <FieldRow label="Anrede">
            <select
              value={form.anrede_id ?? ''}
              onChange={(e) => setForm({ ...form, anrede_id: e.target.value || null })}
              className={inputCls}
            >
              <option value="">—</option>
              {anreden.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Titel">
            <select
              value={form.titel ?? ''}
              onChange={(e) => setForm({ ...form, titel: e.target.value || null })}
              className={inputCls}
            >
              <option value="">—</option>
              {titelWerte.map((w) => (
                <option key={w.id} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Vorname">
              <input
                type="text"
                value={form.vorname ?? ''}
                onChange={(e) => setForm({ ...form, vorname: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Nachname">
              <input
                type="text"
                value={form.nachname ?? ''}
                onChange={(e) => setForm({ ...form, nachname: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          </div>

          <FieldRow label="Rollen (Mehrfachauswahl)">
            {rollenWerte.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Keine Rollen in der Auswahlliste — bitte unter Stammdaten →
                Auswahllisten → „kontakt_rolle&ldquo; pflegen.
              </p>
            ) : (
              <MultiSelectCombobox
                value={form.rollen ?? []}
                onChange={(next) => setForm((f) => ({ ...f, rollen: next }))}
                options={rollenOptions}
                placeholder="Rolle wählen …"
              />
            )}
          </FieldRow>

          <FieldRow label="E-Mail">
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Telefon">
              <input
                type="text"
                value={form.telefon ?? ''}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Mobil">
              <input
                type="text"
                value={form.mobil ?? ''}
                onChange={(e) => setForm({ ...form, mobil: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          </div>

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

          <FieldRow label="Notiz">
            <textarea
              rows={2}
              value={form.notiz ?? ''}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              className={inputCls}
            />
          </FieldRow>

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

        {/* Sticky Footer mit Buttons */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-800 bg-zinc-900 px-6 py-3">
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-400">{label}</div>
      {children}
    </div>
  );
}
