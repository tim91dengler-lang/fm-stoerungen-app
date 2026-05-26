import { useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { GripVertical } from 'lucide-react';
import type { TickettypFeldRead, TickettypRead } from '../api/types';
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
 * Wenn `onReorder` gegeben ist, sind die sichtbaren Felder per
 * Drag-and-Drop direkt in der Vorschau verschiebbar (Tim 2026-05-26).
 * Versteckte Felder behalten ihre globale Position; sichtbare werden
 * untereinander umsortiert und die globale Reihenfolge wird so neu
 * vergeben, dass sichtbare an ihren originalen Slots stehen.
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
  return <input id={id} disabled placeholder={placeholder} className={INPUT_CLASS} />;
}

function PreviewTextarea({ id, placeholder = '' }: { id: string; placeholder?: string }) {
  return (
    <textarea id={id} disabled rows={3} placeholder={placeholder} className={INPUT_CLASS} />
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
      <label
        htmlFor={`preview-${feld.feld_key}`}
        className="block text-sm font-medium text-zinc-300"
      >
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
      <input id={`preview-${f.feld_key}`} type="date" disabled className={INPUT_CLASS} />
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
  tickettyp:
    | (Pick<TickettypRead, 'label' | 'beschreibung' | 'icon' | 'farbe'> & {
        felder: TickettypFeldRead[];
      })
    | null;
  /**
   * Optional: macht die sichtbaren Felder in der Vorschau per Drag-and-Drop
   * sortierbar. Wird die neue Gesamt-Felder-Liste (inkl. unsichtbarer
   * Felder, mit aktualisierter `reihenfolge`) zurückliefert. Bleibt
   * `undefined`, ist die Vorschau read-only.
   */
  onReorder?: (felder: TickettypFeldRead[]) => void;
}

export function VorlagePreviewFelder({ tickettyp, onReorder }: Props) {
  const sichtbar = useMemo<TickettypFeldRead[]>(() => {
    if (!tickettyp) return [];
    return [...tickettyp.felder]
      .filter((f) => f.sichtbar)
      .sort((a, b) => a.reihenfolge - b.reihenfolge);
  }, [tickettyp]);

  const dndEnabled = !!onReorder && sichtbar.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!tickettyp || !onReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sichtbar.findIndex((f) => f.id === active.id);
    const newIdx = sichtbar.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const newVisibleOrder = arrayMove(sichtbar, oldIdx, newIdx);
    // Versteckte Felder behalten ihre globale Position; sichtbare werden
    // an ihren originalen Slots in der globalen Liste durch die neue
    // Reihenfolge ersetzt.
    const queue = [...newVisibleOrder];
    const reordered = tickettyp.felder.map((f) => (f.sichtbar ? (queue.shift() ?? f) : f));
    onReorder(reordered.map((f, idx) => ({ ...f, reihenfolge: idx })));
  }

  if (!tickettyp) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-500">
        Vorlage wählen, um die Vorschau anzuzeigen.
      </div>
    );
  }

  const Icon = iconFor(tickettyp.icon);

  const grid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sichtbar.map((feld) => (
        <PreviewFieldCard key={feld.id ?? feld.feld_key} feld={feld} draggable={dndEnabled} />
      ))}
      {sichtbar.length === 0 && (
        <div className="col-span-full rounded-md border border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-500">
          Keine sichtbaren Felder — alle ausgeblendet.
        </div>
      )}
    </div>
  );

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

      {dndEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sichtbar.map((f) => f.id)}
            strategy={rectSortingStrategy}
          >
            {grid}
          </SortableContext>
        </DndContext>
      ) : (
        grid
      )}

      {dndEnabled && (
        <div className="text-[10px] text-zinc-500">
          Tipp: Felder per Drag-and-Drop verschieben — alternativ Reihenfolge links anpassen.
        </div>
      )}

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

function PreviewFieldCard({
  feld,
  draggable,
}: {
  feld: TickettypFeldRead;
  draggable: boolean;
}) {
  if (!draggable) {
    return <div>{renderFeld(feld)}</div>;
  }
  return <SortablePreviewFieldCard feld={feld} />;
}

function SortablePreviewFieldCard({ feld }: { feld: TickettypFeldRead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable(
    { id: feld.id },
  );
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${feld.label} verschieben`}
      className={clsx(
        'group relative cursor-grab touch-none rounded-md p-1 -m-1 transition-shadow active:cursor-grabbing',
        isDragging
          ? 'bg-emerald-500/5 opacity-60 ring-2 ring-emerald-400/60 shadow-lg'
          : 'hover:bg-zinc-800/30',
      )}
    >
      <GripVertical
        aria-hidden
        className={clsx(
          'pointer-events-none absolute right-1 top-1 h-3.5 w-3.5 transition-colors',
          isDragging
            ? 'text-emerald-400'
            : 'text-zinc-600 group-hover:text-zinc-300',
        )}
      />
      {renderFeld(feld)}
    </div>
  );
}
