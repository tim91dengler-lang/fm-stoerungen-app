import { useMemo, useState } from 'react';
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
import { GripVertical, Star, X } from 'lucide-react';
import type { TickettypFeldRead, TickettypRead } from '../api/types';
import { farbeClass } from './TickettypFarbe';
import { iconFor } from './TickettypIcon';

/**
 * Live-Vorschau des Erfassungsformulars für den Vorlagen-Designer.
 *
 * Tim 2026-05-26: Direkt-Manipulation in der Vorschau — jede Karte hat
 * inline Aktionen (Pflicht-Toggle, Verstecken, Label umbenennen) und
 * ist per DnD untereinander sortierbar. Versteckte Felder landen im
 * VorlagenPool (separate Komponente).
 *
 * Drift-Schutz: rendert direkt aus `tickettyp.felder`, dieselbe Quelle
 * wie das echte TicketErfassenModal — Sichtbar/Pflicht/Reihenfolge sind
 * synchron. Neue System-Felder erfordern parallel: Backend-Migration,
 * DEFAULT_SYSTEM_FELDER, TicketErfassenModal und diese Komponente.
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

// Pro System-Feld eine Render-Funktion (nur die Input-Form, ohne Label-
// Bereich — der wird von der Karten-Hülle gerendert). Fallback unten.
const INPUT_RENDERERS: Record<string, FeldRenderer> = {
  titel: (f) => <PreviewInput id={`preview-${f.feld_key}`} placeholder="Kurze Beschreibung des Problems" />,
  beschreibung: (f) => <PreviewTextarea id={`preview-${f.feld_key}`} placeholder="Details zur Störung" />,
  prio: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Priorität wählen" />,
  kategorie: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Kategorie" />,
  quelle: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Eingangskanal" />,
  melder: (f) => <PreviewInput id={`preview-${f.feld_key}`} placeholder="Name oder Telefonnummer" />,
  objekt: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Objekt auswählen" />,
  haus: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Haus" />,
  stockwerk: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Stockwerk" />,
  einheit: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Einheit" />,
  anlage: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Anlage" />,
  partner: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Partner" />,
  projekt: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Projekt" />,
  faelligkeit_am: (f) => (
    <input id={`preview-${f.feld_key}`} type="date" disabled className={INPUT_CLASS} />
  ),
  wiederholung: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Wiederholung" />,
  fehlercode: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Fehlercode" />,
  pin: () => (
    <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
      Foto-Pin wird beim Ticket per Klick auf den Grundriss gesetzt.
    </div>
  ),
  foto: () => (
    <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
      Foto-Upload erfolgt nach Anlage am Ticket.
    </div>
  ),
  dokumente: () => (
    <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
      Dokumente werden nach Anlage am Ticket verknüpft.
    </div>
  ),
};

function renderInput(feld: TickettypFeldRead): React.ReactNode {
  const r = INPUT_RENDERERS[feld.feld_key];
  if (r) return r(feld);
  return <PreviewInput id={`preview-${feld.feld_key}`} placeholder={feld.label} />;
}

export interface FeldUpdate {
  label?: string;
  sichtbar?: boolean;
  pflicht?: boolean;
}

interface Props {
  /** Aktueller Designer-Stand. `null` = nichts ausgewählt. */
  tickettyp:
    | (Pick<TickettypRead, 'label' | 'beschreibung' | 'icon' | 'farbe'> & {
        felder: TickettypFeldRead[];
      })
    | null;
  /**
   * Sortier-Callback für DnD innerhalb der Vorschau. Erhält die neue
   * Gesamt-Felder-Liste mit aktualisierten reihenfolge-Indizes.
   */
  onReorder?: (felder: TickettypFeldRead[]) => void;
  /**
   * Update-Callback für inline Aktionen (Pflicht-Toggle, Verstecken,
   * Label umbenennen). Erhält feld_key und Teil-Update.
   */
  onUpdateFeld?: (feldKey: string, update: FeldUpdate) => void;
}

export function VorlagePreviewFelder({ tickettyp, onReorder, onUpdateFeld }: Props) {
  const sichtbar = useMemo<TickettypFeldRead[]>(() => {
    if (!tickettyp) return [];
    return [...tickettyp.felder]
      .filter((f) => f.sichtbar)
      .sort((a, b) => a.reihenfolge - b.reihenfolge);
  }, [tickettyp]);

  const dndEnabled = !!onReorder && sichtbar.length > 1;
  const editEnabled = !!onUpdateFeld;

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

  const cards = sichtbar.map((feld) => (
    <PreviewFieldCard
      key={feld.id ?? feld.feld_key}
      feld={feld}
      draggable={dndEnabled}
      editable={editEnabled}
      onUpdateFeld={onUpdateFeld}
    />
  ));

  const grid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.length > 0 ? (
        cards
      ) : (
        <div className="col-span-full rounded-md border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-500">
          Alle Felder ausgeblendet — links im Pool wieder einblenden.
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sichtbar.map((f) => f.id)} strategy={rectSortingStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      ) : (
        grid
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

interface CardProps {
  feld: TickettypFeldRead;
  draggable: boolean;
  editable: boolean;
  onUpdateFeld?: (feldKey: string, update: FeldUpdate) => void;
}

function PreviewFieldCard({ feld, draggable, editable, onUpdateFeld }: CardProps) {
  if (draggable) {
    return <SortableFieldCard feld={feld} editable={editable} onUpdateFeld={onUpdateFeld} />;
  }
  return (
    <CardBody
      feld={feld}
      draggable={false}
      isDragging={false}
      editable={editable}
      onUpdateFeld={onUpdateFeld}
    />
  );
}

function SortableFieldCard({
  feld,
  editable,
  onUpdateFeld,
}: {
  feld: TickettypFeldRead;
  editable: boolean;
  onUpdateFeld?: (feldKey: string, update: FeldUpdate) => void;
}) {
  const sortable = useSortable({ id: feld.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <CardBody
        feld={feld}
        draggable
        isDragging={sortable.isDragging}
        editable={editable}
        onUpdateFeld={onUpdateFeld}
      />
    </div>
  );
}

interface BodyProps {
  feld: TickettypFeldRead;
  draggable: boolean;
  isDragging: boolean;
  editable: boolean;
  onUpdateFeld?: (feldKey: string, update: FeldUpdate) => void;
}

// Karten-Body: Grip + Label + Aktionen + Input. Wird sowohl in der
// Sortable-Wrapper-Hülle als auch ohne DnD direkt eingesetzt.
function CardBody({ feld, draggable, isDragging, editable, onUpdateFeld }: BodyProps) {
  return (
    <div
      className={clsx(
        'group relative rounded-md p-2 transition-shadow',
        draggable && 'cursor-grab touch-none active:cursor-grabbing',
        isDragging
          ? 'bg-emerald-500/5 opacity-60 ring-2 ring-emerald-400/60 shadow-lg'
          : draggable && 'hover:bg-zinc-800/30',
      )}
    >
      {draggable && (
        <GripVertical
          aria-hidden
          className={clsx(
            'pointer-events-none absolute left-1 top-1 h-3.5 w-3.5 transition-colors',
            isDragging ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-300',
          )}
        />
      )}

      <div className="flex items-center gap-1 pl-5">
        <LabelArea feld={feld} editable={editable} onUpdateFeld={onUpdateFeld} />
        <div className="ml-auto flex items-center gap-0.5">
          {editable && onUpdateFeld && (
            <>
              <PflichtToggleButton
                pflicht={feld.pflicht}
                onClick={() => onUpdateFeld(feld.feld_key, { pflicht: !feld.pflicht })}
              />
              <VerbergenButton
                onClick={() => onUpdateFeld(feld.feld_key, { sichtbar: false })}
              />
            </>
          )}
        </div>
      </div>

      <div>{renderInput(feld)}</div>
    </div>
  );
}

function LabelArea({
  feld,
  editable,
  onUpdateFeld,
}: {
  feld: TickettypFeldRead;
  editable: boolean;
  onUpdateFeld?: (feldKey: string, update: FeldUpdate) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(feld.label);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === feld.label) {
      setDraft(feld.label);
      return;
    }
    onUpdateFeld?.(feld.feld_key, { label: next });
  }

  if (editing && editable) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setDraft(feld.label);
            setEditing(false);
          }
        }}
        className="w-full max-w-[14rem] rounded-sm border border-emerald-500/60 bg-zinc-950 px-1 py-0.5 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
      />
    );
  }

  return (
    <span
      onClick={
        editable
          ? (e) => {
              e.stopPropagation();
              setEditing(true);
            }
          : undefined
      }
      onPointerDown={editable ? (e) => e.stopPropagation() : undefined}
      title={editable ? 'Klick zum Umbenennen' : undefined}
      className={clsx(
        'truncate text-sm font-medium text-zinc-300',
        editable && 'cursor-text hover:text-zinc-100 hover:underline decoration-dotted',
      )}
    >
      {feld.label}
      {feld.pflicht && <span className="ml-0.5 text-red-400">*</span>}
    </span>
  );
}

function PflichtToggleButton({ pflicht, onClick }: { pflicht: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={pflicht ? 'Auf optional setzen' : 'Auf Pflicht setzen'}
      aria-label={pflicht ? 'Auf optional setzen' : 'Auf Pflicht setzen'}
      className={clsx(
        'rounded p-1 transition-colors',
        pflicht
          ? 'text-amber-400 hover:bg-amber-500/15'
          : 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-300',
      )}
    >
      <Star
        className={clsx('h-3.5 w-3.5', pflicht && 'fill-amber-400')}
      />
    </button>
  );
}

function VerbergenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title="Aus der Vorschau ausblenden"
      aria-label="Verbergen"
      className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
