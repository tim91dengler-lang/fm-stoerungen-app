import { useMemo } from 'react';
import clsx from 'clsx';
import type { TickettypRead, TickettypFeldRead } from '../api/types';
import { farbeClass } from './TickettypFarbe';
import { iconFor } from './TickettypIcon';

/**
 * Live-Vorschau des Erfassungsformulars für den VorlageDesignerModal.
 *
 * Spec §5.3 — rendert die 19 System-Felder als disabled HTML-Elemente
 * mit Label und Pflicht-Stern, sortiert nach `tickettyp.felder[].reihenfolge`.
 * KEINE echten Datenquellen (Objekte/Partner/etc.) — nur strukturelle
 * Vorschau, wie die Maske aussehen wird.
 *
 * Drift-Schutz: rendert direkt aus `tickettyp.felder`, dieselbe Quelle
 * wie das echte TicketErfassenModal — Sichtbar/Pflicht/Reihenfolge sind
 * pro Definition synchron. Wenn neue System-Felder hinzukommen, müssen
 * Backend (Migration + DEFAULT_SYSTEM_FELDER), TicketErfassenModal UND
 * diese Komponente parallel erweitert werden.
 */

type FeldRenderer = (feld: TickettypFeldRead) => React.ReactNode;

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60';

function PreviewInput({ id, placeholder = '' }: { id: string; placeholder?: string }) {
  return (
    <input id={id} disabled placeholder={placeholder} className={INPUT_CLASS} />
  );
}

function PreviewTextarea({ id, placeholder = '' }: { id: string; placeholder?: string }) {
  return (
    <textarea
      id={id}
      disabled
      rows={3}
      placeholder={placeholder}
      className={INPUT_CLASS}
    />
  );
}

function PreviewSelect({ id, hint }: { id: string; hint: string }) {
  return (
    <select id={id} disabled className={INPUT_CLASS}>
      <option>— {hint} —</option>
    </select>
  );
}

function FieldShell({
  feld,
  children,
}: {
  feld: TickettypFeldRead;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`preview-${feld.feld_key}`} className="block text-sm font-medium text-zinc-300">
        {feld.label} {feld.pflicht && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

// Pro System-Feld eine Render-Funktion. Falls ein Slug fehlt, fällt
// die Komponente auf ein generisches Text-Input zurück.
const RENDERERS: Record<string, FeldRenderer> = {
  titel: (f) => (
    <FieldShell feld={f}>
      <PreviewInput id={`preview-${f.feld_key}`} placeholder="Kurze Beschreibung des Problems" />
    </FieldShell>
  ),
  beschreibung: (f) => (
    <FieldShell feld={f}>
      <PreviewTextarea id={`preview-${f.feld_key}`} placeholder="Details zur Störung" />
    </FieldShell>
  ),
  prio: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Priorität wählen" />
    </FieldShell>
  ),
  kategorie: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Kategorie" />
    </FieldShell>
  ),
  quelle: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Eingangskanal" />
    </FieldShell>
  ),
  melder: (f) => (
    <FieldShell feld={f}>
      <PreviewInput id={`preview-${f.feld_key}`} placeholder="Name oder Telefonnummer" />
    </FieldShell>
  ),
  objekt: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Objekt auswählen" />
    </FieldShell>
  ),
  haus: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Haus" />
    </FieldShell>
  ),
  stockwerk: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Stockwerk" />
    </FieldShell>
  ),
  einheit: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Einheit" />
    </FieldShell>
  ),
  anlage: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Anlage" />
    </FieldShell>
  ),
  partner: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Partner" />
    </FieldShell>
  ),
  projekt: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Projekt" />
    </FieldShell>
  ),
  faelligkeit_am: (f) => (
    <FieldShell feld={f}>
      <input
        id={`preview-${f.feld_key}`}
        type="date"
        disabled
        className={INPUT_CLASS}
      />
    </FieldShell>
  ),
  wiederholung: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Wiederholung" />
    </FieldShell>
  ),
  fehlercode: (f) => (
    <FieldShell feld={f}>
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Fehlercode" />
    </FieldShell>
  ),
  // Post-Anlage-Felder (im Erfassungs-Modal nicht direkt erfassbar — werden
  // beim Ticket nach Anlage konfiguriert). Im Preview als Hinweis-Zeile.
  pin: (f) => (
    <FieldShell feld={f}>
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Foto-Pin wird beim Ticket per Klick auf den Grundriss gesetzt.
      </div>
    </FieldShell>
  ),
  foto: (f) => (
    <FieldShell feld={f}>
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Foto-Upload erfolgt nach Anlage am Ticket.
      </div>
    </FieldShell>
  ),
  dokumente: (f) => (
    <FieldShell feld={f}>
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Dokumente werden nach Anlage am Ticket verknüpft.
      </div>
    </FieldShell>
  ),
};

function renderFeld(feld: TickettypFeldRead): React.ReactNode {
  const r = RENDERERS[feld.feld_key];
  if (r) return r(feld);
  // Fallback für unbekannte Slugs — generisches Text-Input
  return (
    <FieldShell feld={feld}>
      <PreviewInput id={`preview-${feld.feld_key}`} placeholder={feld.label} />
    </FieldShell>
  );
}

interface Props {
  /** Aktueller Designer-Stand. `null` = nichts ausgewählt. */
  tickettyp: Pick<TickettypRead, 'label' | 'beschreibung' | 'icon' | 'farbe'> & {
    felder: TickettypFeldRead[];
  } | null;
}

export function VorlagePreviewFelder({ tickettyp }: Props) {
  const sichtbar = useMemo<TickettypFeldRead[]>(() => {
    if (!tickettyp) return [];
    return [...tickettyp.felder]
      .filter((f) => f.sichtbar)
      .sort((a, b) => a.reihenfolge - b.reihenfolge);
  }, [tickettyp]);

  if (!tickettyp) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-500">
        Vorlage wählen, um die Vorschau anzuzeigen.
      </div>
    );
  }

  const Icon = iconFor(tickettyp.icon);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 border-b border-zinc-800 pb-3">
        <span
          className={clsx(
            'inline-flex h-10 w-10 items-center justify-center rounded-md border',
            farbeClass(tickettyp.farbe),
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="text-base font-semibold text-zinc-100">
            {tickettyp.label || '— ohne Bezeichnung —'}
          </div>
          {tickettyp.beschreibung && (
            <div className="text-xs text-zinc-500">{tickettyp.beschreibung}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sichtbar.map((feld) => (
          <div key={feld.id ?? feld.feld_key}>{renderFeld(feld)}</div>
        ))}
        {sichtbar.length === 0 && (
          <div className="col-span-full rounded-md border border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-500">
            Keine sichtbaren Felder — alle ausgeblendet.
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          disabled
          className="rounded-md bg-emerald-500/40 px-4 py-2 text-sm font-medium text-zinc-950 opacity-60"
        >
          Anlegen
        </button>
      </div>
    </div>
  );
}
