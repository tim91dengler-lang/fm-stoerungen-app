import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { adresseApi } from '../api/endpoints';
import type { AdresseCreate, AdresseRead, AdresseSuggestion } from '../api/types';
import { AdresseSearchSelect } from './AdresseSearchSelect';
import { AdressSuggestCombobox } from './AdressSuggestCombobox';
import { formatAdresse, mapsUrl } from '../lib/adresse';

interface Props {
  /** Effektive Adresse (eigene, sonst Objekt-Adresse als Default). */
  adresse: AdresseRead | null;
  /** Eigene Ticket-Adresse gesetzt (Override) — sonst kommt sie vom Objekt. */
  isEigen: boolean;
  /** Setzt/entfernt die Ticket-eigene Adresse (null = zurück auf Objekt-Default).
   *  Liefert auch die gewählte/angelegte AdresseRead mit (für Anzeige ohne Refetch). */
  onSet: (adresseId: string | null, adresse: AdresseRead | null) => void;
}

type NewForm = {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  latitude: number | null;
  longitude: number | null;
};

const EMPTY: NewForm = {
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  land: 'DE',
  latitude: null,
  longitude: null,
};

/**
 * Ticket-Adresse: zeigt die effektive Adresse als Google-Maps-Link mit Herkunfts-
 * Hinweis und erlaubt sie zu ändern — entweder eine vorhandene Adresse wählen
 * oder eine neue inline anlegen (Photon-Vorausfüllung, im Hintergrund gespeichert).
 */
export function TicketAdresseField({ adresse, isEigen, onSet }: Props) {
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewForm>({ ...EMPTY });
  const [suggestQuery, setSuggestQuery] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (payload: AdresseCreate) => adresseApi.create(payload),
    onSuccess: (a) => {
      onSet(a.id, a);
      close();
    },
    onError: () => setCreateError('Adresse konnte nicht angelegt werden.'),
  });

  function close() {
    setEditing(false);
    setCreating(false);
    setForm({ ...EMPTY });
    setSuggestQuery('');
    setCreateError(null);
  }

  function applySuggestion(s: AdresseSuggestion) {
    setForm((p) => ({
      ...p,
      strasse: s.strasse ?? p.strasse,
      hausnummer: s.hausnummer ?? p.hausnummer,
      plz: s.plz ?? p.plz,
      ort: s.ort ?? p.ort,
      land: (s.land ?? p.land ?? 'DE').toUpperCase(),
      latitude: s.latitude,
      longitude: s.longitude,
    }));
    setSuggestQuery(s.label);
  }

  const canCreate = form.strasse.trim() && form.plz.trim() && form.ort.trim();

  function submitNew() {
    if (!canCreate) return;
    const payload: AdresseCreate = {
      strasse: form.strasse.trim(),
      hausnummer: form.hausnummer.trim() || null,
      plz: form.plz.trim(),
      ort: form.ort.trim(),
      land: form.land.trim() || 'DE',
      latitude: form.latitude,
      longitude: form.longitude,
      geocode_source: form.latitude != null ? 'photon' : null,
    };
    createMut.mutate(payload);
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
        <MapPin className="h-3.5 w-3.5" /> Adresse
      </div>

      {/* Anzeige */}
      {adresse ? (
        <div className="flex items-start justify-between gap-2">
          <a
            href={mapsUrl(adresse)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-start gap-1.5 rounded-md border border-zinc-800 bg-zinc-950/40 px-2.5 py-2 text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/5"
            title="In Google Maps öffnen"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{formatAdresse(adresse)}</span>
              <span className="text-[10px] text-zinc-500">
                {isEigen ? 'eigene Adresse' : 'vom Objekt'} · In Google Maps öffnen ↗
              </span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="mt-1 shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Adresse ändern"
            aria-label="Adresse ändern"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
        >
          <Plus className="h-3.5 w-3.5" /> Adresse setzen
        </button>
      )}

      {/* Editor */}
      {editing && (
        <div className="mt-2 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Adresse ändern</span>
            <button
              type="button"
              onClick={close}
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Schließen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!creating ? (
            <>
              <AdresseSearchSelect
                selected={isEigen ? adresse : null}
                onChange={(a) => {
                  if (a) {
                    onSet(a.id, a);
                    close();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Neue Adresse anlegen
                </button>
                {isEigen && (
                  <button
                    type="button"
                    onClick={() => {
                      onSet(null, null);
                      close();
                    }}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                    title="Eigene Adresse entfernen — zurück auf Objekt-Adresse"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Auf Objekt-Adresse zurück
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <AdressSuggestCombobox
                value={suggestQuery}
                onChange={setSuggestQuery}
                onSelect={applySuggestion}
                placeholder="Adresse tippen (Vorschläge) …"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={form.strasse}
                  onChange={(e) => setForm((p) => ({ ...p, strasse: e.target.value }))}
                  placeholder="Straße"
                  className="col-span-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                />
                <input
                  value={form.hausnummer}
                  onChange={(e) => setForm((p) => ({ ...p, hausnummer: e.target.value }))}
                  placeholder="Nr."
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                />
                <input
                  value={form.plz}
                  onChange={(e) => setForm((p) => ({ ...p, plz: e.target.value }))}
                  placeholder="PLZ"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                />
                <input
                  value={form.ort}
                  onChange={(e) => setForm((p) => ({ ...p, ort: e.target.value }))}
                  placeholder="Ort"
                  className="col-span-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ← Vorhandene wählen
                </button>
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={!canCreate || createMut.isPending}
                  className="rounded-md bg-emerald-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {createMut.isPending ? 'Anlegen …' : 'Anlegen & übernehmen'}
                </button>
              </div>
              {createError && <p className="text-[11px] text-red-400">{createError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
