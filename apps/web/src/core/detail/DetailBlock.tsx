import { ChevronRight } from 'lucide-react';

/**
 * Eine Block-Sektion im Detail (Master-Layout-Standard, siehe
 * `docs/concepts/Konzept_UIUX_MasterLayout_FINAL_2026-06-02.md` §5.2 + Skill
 * `modul-standard`). Accordion mit progressiver Offenlegung: häufig Genutztes
 * `defaultOpen`, Seltenes/Kontext/Historie zugeklappt. Render-agnostisch — der
 * Aufrufer steckt Felder oder eine RelationList rein.
 */
export interface DetailBlockProps {
  title: string;
  /** Beim Öffnen aufgeklappt (häufig genutzt) oder zu (selten/Kontext). */
  defaultOpen?: boolean;
  /** Kennzeichnet einen Verknüpfungs-Block (öffnet eine Liste). */
  isRelation?: boolean;
  /** Zähler rechts im Kopf (z. B. Feld- oder Treffer-Anzahl). */
  count?: number;
  /** Stabiler Schlüssel für Sprung-Chips (scrollIntoView). */
  blockKey?: string;
  children: React.ReactNode;
}

export function DetailBlock({
  title,
  defaultOpen = false,
  isRelation = false,
  count,
  blockKey,
  children,
}: DetailBlockProps) {
  return (
    <details
      open={defaultOpen}
      data-block={blockKey ?? title}
      className="group scroll-mt-2 rounded-lg border border-zinc-800 bg-zinc-900/40"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 lg:min-h-0">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform group-open:rotate-90" />
        <span>{title}</span>
        {isRelation && (
          <span className="rounded bg-emerald-700/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
            Verknüpfung
          </span>
        )}
        {count !== undefined && (
          <span className="ml-auto text-[10px] font-normal text-zinc-600">{count}</span>
        )}
      </summary>
      <div className="border-t border-zinc-800 px-3 py-3">{children}</div>
    </details>
  );
}
