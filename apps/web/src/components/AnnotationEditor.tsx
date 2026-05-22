import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Circle, Save, Search } from 'lucide-react';
import { photoApi } from '../api/endpoints';
import type { PhotoAnnotation, TicketPhotoRead } from '../api/types';

interface Props {
  ticketId: string;
  photo: TicketPhotoRead;
  imageUrl: string;
}

type Tool =
  | { type: 'stempel'; kind: 'defekt' | 'pruefen' | 'ok' }
  | { type: 'kreis'; color: 'red' | 'yellow' | 'green' }
  | { type: 'view' };

type StempelKind = 'defekt' | 'pruefen' | 'ok';
type KreisColor = 'red' | 'yellow' | 'green';

const STEMPEL_LABELS: Record<StempelKind, string> = {
  defekt: 'Defekt',
  pruefen: 'Prüfen',
  ok: 'OK',
};

const STEMPEL_COLORS: Record<StempelKind, string> = {
  defekt: 'bg-red-500 text-white',
  pruefen: 'bg-amber-500 text-zinc-900',
  ok: 'bg-emerald-500 text-zinc-950',
};

const KREIS_COLORS: Record<KreisColor, string> = {
  red: 'border-red-400',
  yellow: 'border-amber-400',
  green: 'border-emerald-400',
};

export function AnnotationEditor({ ticketId, photo, imageUrl }: Props) {
  const qc = useQueryClient();
  const [tool, setTool] = useState<Tool>({ type: 'view' });
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>(
    photo.annotations,
  );
  const [dirty, setDirty] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnnotations(photo.annotations);
    setDirty(false);
  }, [photo.id, photo.annotations]);

  const save = useMutation({
    mutationFn: () =>
      photoApi.update(ticketId, photo.id, { annotations }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-photos', ticketId] });
      setDirty(false);
    },
  });

  function imageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (tool.type === 'view') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const next: PhotoAnnotation =
      tool.type === 'stempel'
        ? { type: 'stempel', kind: tool.kind, x, y }
        : { type: 'kreis', color: tool.color, x, y, r: 0.06 };
    setAnnotations((prev) => [...prev, next]);
    setDirty(true);
  }

  function removeAnnotation(idx: number) {
    setAnnotations((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  return (
    <div className="flex w-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <ToolButton
          active={tool.type === 'view'}
          onClick={() => setTool({ type: 'view' })}
          icon={<Search className="h-3.5 w-3.5" />}
          label="Ansehen"
        />
        <div className="mx-2 h-5 w-px bg-zinc-800" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Stempel:
        </span>
        {(['defekt', 'pruefen', 'ok'] as const).map((k) => (
          <ToolButton
            key={k}
            active={tool.type === 'stempel' && tool.kind === k}
            onClick={() => setTool({ type: 'stempel', kind: k })}
            icon={
              k === 'defekt' ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : k === 'pruefen' ? (
                <Search className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )
            }
            label={STEMPEL_LABELS[k]}
            color={STEMPEL_COLORS[k]}
          />
        ))}
        <div className="mx-2 h-5 w-px bg-zinc-800" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Markier-Kreis:
        </span>
        {(['red', 'yellow', 'green'] as const).map((c) => (
          <ToolButton
            key={c}
            active={tool.type === 'kreis' && tool.color === c}
            onClick={() => setTool({ type: 'kreis', color: c })}
            icon={
              <Circle
                className={`h-3.5 w-3.5 ${
                  c === 'red'
                    ? 'text-red-400'
                    : c === 'yellow'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}
              />
            }
            label={c === 'red' ? 'Rot' : c === 'yellow' ? 'Gelb' : 'Grün'}
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="text-[10px] text-amber-400">
              ungesicherte Änderungen
            </span>
          )}
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Image + Overlay */}
      <div
        ref={containerRef}
        onClick={imageClick}
        className={`relative inline-block ${
          tool.type !== 'view' ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={photo.filename}
          className="max-h-[70vh] max-w-full object-contain"
          draggable={false}
        />
        {annotations.map((a, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (tool.type === 'view') return;
              removeAnnotation(idx);
            }}
            style={{
              left: `${a.x * 100}%`,
              top: `${a.y * 100}%`,
            }}
            title={
              tool.type === 'view'
                ? 'Annotation'
                : 'Klick = entfernen'
            }
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            {a.type === 'stempel' && (
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold shadow-lg ${
                  STEMPEL_COLORS[a.kind ?? 'defekt']
                }`}
              >
                {STEMPEL_LABELS[a.kind ?? 'defekt']}
              </span>
            )}
            {a.type === 'kreis' && (
              <span
                className={`block rounded-full border-4 ${
                  KREIS_COLORS[a.color ?? 'red']
                } bg-transparent shadow-lg`}
                style={{
                  width: `${(a.r ?? 0.06) * 200}px`,
                  height: `${(a.r ?? 0.06) * 200}px`,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      {photo.beschreibung && (
        <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Bemerkung:
          </span>{' '}
          {photo.beschreibung}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
        active
          ? color
            ? color
            : 'bg-emerald-500/15 text-emerald-300'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

