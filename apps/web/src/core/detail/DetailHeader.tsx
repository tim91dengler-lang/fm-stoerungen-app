import { X } from 'lucide-react';

import { useDetailNav } from './DetailNav';

/**
 * Detail-Kopf (Master-Layout-Standard §5.2): Identität (Titel + Untertitel +
 * Status-Badges) + Schließen + Sprung-Chips. Feld-Chips scrollen zur Sektion
 * (mit Flash-Feedback), Verknüpfungs-Chips öffnen die Liste (per `onClick`).
 * Der gerade sichtbare Block wird per Scroll-Spy am Chip markiert.
 */
export interface DetailBadge {
  label: string;
  className?: string;
}
export interface DetailChip {
  label: string;
  /** Scrollt zu `[data-block="blockKey"]`, klappt auf und blitzt kurz. */
  blockKey?: string;
  /** Stattdessen eine Aktion (z. B. Verknüpfungs-Liste öffnen). */
  onClick?: () => void;
  /**
   * Block, dessen Sichtbarkeit den Aktiv-Zustand dieses Chips steuert — nötig
   * für Verknüpfungs-Chips, die per `onClick` eine Liste öffnen, aber trotzdem
   * mitleuchten sollen, wenn ihr Block im Body sichtbar ist.
   */
  activeKey?: string;
  isRelation?: boolean;
}

export interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  badges?: DetailBadge[];
  chips?: DetailChip[];
  onClose: () => void;
}

export function DetailHeader({ title, subtitle, badges, chips, onClose }: DetailHeaderProps) {
  const { activeBlock, scrollToBlock } = useDetailNav();
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
          {chips.map((c, i) => {
            const watchKey = c.blockKey ?? c.activeKey;
            const active = watchKey != null && activeBlock === watchKey;
            return (
              <button
                key={i}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={
                  c.onClick ? c.onClick : c.blockKey ? () => scrollToBlock(c.blockKey!) : undefined
                }
                className={
                  'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ' +
                  (active
                    ? 'border-emerald-500 bg-emerald-500/15 font-medium text-emerald-200'
                    : c.isRelation
                      ? 'border-emerald-600/50 text-emerald-300 hover:border-emerald-500/60'
                      : 'border-zinc-700 text-zinc-300 hover:border-emerald-500/60 hover:text-zinc-100')
                }
              >
                {c.label}
                {c.isRelation && ' ↗'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
