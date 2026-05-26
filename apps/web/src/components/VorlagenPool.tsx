import { Plus } from 'lucide-react';
import type { TickettypFeldRead } from '../api/types';

interface Props {
  /** Die versteckten Felder (sichtbar=false), in Reihenfolge. */
  felder: TickettypFeldRead[];
  /** Wird mit feld_key aufgerufen — Page setzt sichtbar=true. */
  onShow: (feldKey: string) => void;
}

/**
 * Pool der ausgeblendeten Felder im Vorlagen-Designer.
 *
 * Tim 2026-05-26: User-Mental-Model ist „Felder, die nicht in der
 * Erfassungs-Maske sind". Klick auf „+" blendet ein Feld wieder ein —
 * es wandert in die Live-Vorschau. Verstecken läuft umgekehrt über
 * das ×-Icon an der Vorschau-Karte.
 *
 * Kein Drag-and-Drop zwischen Pool und Vorschau (cross-container DnD
 * mit @dnd-kit ist deutlich aufwändiger und Edge-Case-anfällig; Klick
 * ist klarer und auf Touch zuverlässiger).
 */
export function VorlagenPool({ felder, onShow }: Props) {
  if (felder.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center text-xs text-zinc-500">
        Alle Felder sind in der Vorschau eingeblendet.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {felder.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onShow(f.feld_key)}
          className="group flex w-full items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1.5 text-left text-sm hover:border-emerald-500/40 hover:bg-emerald-500/5"
          title={`„${f.label}" in der Vorschau einblenden`}
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-emerald-400" />
          <span className="flex-1 truncate text-zinc-300 group-hover:text-zinc-100">
            {f.label}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">{f.feld_key}</span>
        </button>
      ))}
    </div>
  );
}
