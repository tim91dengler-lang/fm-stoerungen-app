import { X } from 'lucide-react';

/**
 * Detail-Kopf (Master-Layout-Standard §5.2): Identität (Titel + Untertitel +
 * Status-Badges) + Schließen + Sprung-Chips. Feld-Chips scrollen zur Sektion,
 * Verknüpfungs-Chips öffnen die Liste (per `onClick`).
 */
export interface DetailBadge {
  label: string;
  className?: string;
}
export interface DetailChip {
  label: string;
  /** Scrollt zu `[data-block="blockKey"]` und klappt auf. */
  blockKey?: string;
  /** Stattdessen eine Aktion (z. B. Verknüpfungs-Liste öffnen). */
  onClick?: () => void;
  isRelation?: boolean;
}

export interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  badges?: DetailBadge[];
  chips?: DetailChip[];
  onClose: () => void;
}

function scrollToBlock(blockKey: string) {
  const el = document.querySelector<HTMLDetailsElement>(`[data-block="${CSS.escape(blockKey)}"]`);
  if (el) {
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function DetailHeader({ title, subtitle, badges, chips, onClose }: DetailHeaderProps) {
  return (
    <div className="border-b border-zinc-800 px-5 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-zinc-100">{title}</span>
            {badges?.map((b, i) => (
              <span
                key={i}
                className={`rounded px-2 py-0.5 text-xs font-medium ${b.className ?? 'bg-zinc-700/40 text-zinc-300'}`}
              >
                {b.label}
              </span>
            ))}
          </div>
          {subtitle && <div className="truncate text-xs text-zinc-500">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-4 w-4" /> schließen
        </button>
      </div>
      {chips && chips.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {chips.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={c.onClick ? c.onClick : c.blockKey ? () => scrollToBlock(c.blockKey!) : undefined}
              className={
                'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs hover:border-emerald-500/60 ' +
                (c.isRelation ? 'border-emerald-600/50 text-emerald-300' : 'border-zinc-700 text-zinc-300')
              }
            >
              {c.label}
              {c.isRelation && ' ↗'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
