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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from 'lucide-react';
import type { TickettypFeldRead } from '../api/types';

interface Props {
  felder: TickettypFeldRead[];
  onChange: (felder: TickettypFeldRead[]) => void;
}

/**
 * Sortierbare Felder-Liste für Vorlagen-Designer (Spec §5.6).
 *
 * Sortieren primär per Drag-and-Drop (Grip-Handle links), zusätzlich
 * ↑↓-Pills rechts als Fallback (Touch / Tastatur-User). DnD ist mit
 * KeyboardSensor accessibility-tauglich (Space zum Greifen, ↑/↓ zum
 * Verschieben, Esc zum Abbrechen).
 *
 * Schreibt nicht direkt ans Backend — Änderungen werden via `onChange`
 * an den Designer-Modal-Parent gemeldet und erst beim Speichern persistiert.
 */
export function VorlageFelderListe({ felder, onChange }: Props) {
  const sorted = useMemo(
    () => [...felder].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [felder],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sorted.findIndex((f) => f.id === active.id);
    const newIdx = sorted.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(sorted, oldIdx, newIdx).map((f, idx) => ({
      ...f,
      reihenfolge: idx,
    }));
    onChange(reordered);
  }

  function move(feld: TickettypFeldRead, direction: -1 | 1) {
    const idx = sorted.findIndex((f) => f.id === feld.id);
    const target = idx + direction;
    if (target < 0 || target >= sorted.length) return;
    const reordered = arrayMove(sorted, idx, target).map((f, i) => ({
      ...f,
      reihenfolge: i,
    }));
    onChange(reordered);
  }

  function toggleSichtbar(feld: TickettypFeldRead) {
    const next = sorted.map((f) =>
      f.id === feld.id ? { ...f, sichtbar: !f.sichtbar } : f,
    );
    onChange(next);
  }

  function togglePflicht(feld: TickettypFeldRead) {
    const next = sorted.map((f) =>
      f.id === feld.id ? { ...f, pflicht: !f.pflicht } : f,
    );
    onChange(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {sorted.map((f, idx) => (
            <SortableFeldRow
              key={f.id}
              feld={f}
              isFirst={idx === 0}
              isLast={idx === sorted.length - 1}
              onToggleSichtbar={() => toggleSichtbar(f)}
              onTogglePflicht={() => togglePflicht(f)}
              onMoveUp={() => move(f, -1)}
              onMoveDown={() => move(f, 1)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  feld: TickettypFeldRead;
  isFirst: boolean;
  isLast: boolean;
  onToggleSichtbar: () => void;
  onTogglePflicht: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableFeldRow({
  feld,
  isFirst,
  isLast,
  onToggleSichtbar,
  onTogglePflicht,
  onMoveUp,
  onMoveDown,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feld.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 rounded-md border px-2 py-2 text-sm',
        feld.sichtbar
          ? 'border-zinc-800 bg-zinc-950/60'
          : 'border-zinc-800 bg-zinc-950/30 opacity-60',
        isDragging && 'ring-2 ring-emerald-400/60 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${feld.label} verschieben`}
        className="cursor-grab touch-none rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-zinc-200">{feld.label}</div>
        <div className="font-mono text-[10px] text-zinc-500">{feld.feld_key}</div>
      </div>

      <button
        type="button"
        onClick={onToggleSichtbar}
        className={clsx(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
          feld.sichtbar
            ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-zinc-800 text-zinc-400',
        )}
      >
        {feld.sichtbar ? (
          <>
            <Eye className="h-3 w-3" /> Sichtbar
          </>
        ) : (
          <>
            <EyeOff className="h-3 w-3" /> Versteckt
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onTogglePflicht}
        disabled={!feld.sichtbar}
        className={clsx(
          'rounded-md px-2 py-1 text-xs',
          feld.pflicht
            ? 'bg-amber-500/15 text-amber-300'
            : 'bg-zinc-800 text-zinc-400',
          !feld.sichtbar && 'cursor-not-allowed opacity-40',
        )}
      >
        {feld.pflicht ? 'Pflicht' : 'Optional'}
      </button>

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Nach oben"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Nach unten"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
