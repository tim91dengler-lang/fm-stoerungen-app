import { ArrowRight, CornerDownRight } from 'lucide-react';

/**
 * Verknüpfungs-Vorschau im Detail (Master-Layout-Standard §5.5): zeigt eine
 * kurze Vorschau (Default 4) der verknüpften Datensätze + Gesamtzähler und einen
 * Button „in Listenansicht öffnen", der die NÄCHSTE Ebene aufmacht — eine
 * vollwertige, vorgefilterte Liste (PowerListenView). KEINE eigene Mini-Engine,
 * damit auch tausende Verknüpfungen durchsuchbar bleiben.
 */
export interface RelationItem {
  id: string;
  /** Primärtext der Zeile (z. B. „#1042 Heizung fällt aus"). */
  label: string;
  /** Optionaler Zusatz rechts (z. B. ein Status). */
  trailing?: React.ReactNode;
}

export interface RelationListProps {
  items: RelationItem[];
  /** Gesamtanzahl (kann größer als items.length sein). */
  total: number;
  /** Öffnet Ebene 3: die vollwertige, vorgefilterte Liste. */
  onOpenList: () => void;
  /** Klick auf eine Vorschau-Zeile (öffnet deren Detail). Optional. */
  onItemClick?: (id: string) => void;
  /** Wie viele Zeilen in der Vorschau. Default 4. */
  previewCount?: number;
  emptyLabel?: string;
}

export function RelationList({
  items,
  total,
  onOpenList,
  onItemClick,
  previewCount = 4,
  emptyLabel = '— keine Verknüpfungen —',
}: RelationListProps) {
  const preview = items.slice(0, previewCount);
  const rest = total - preview.length;
  return (
    <div className="space-y-1.5">
      {preview.length === 0 ? (
        <div className="px-2 py-1 text-[11px] text-zinc-600">{emptyLabel}</div>
      ) : (
        preview.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={onItemClick ? () => onItemClick(it.id) : undefined}
            className={
              'flex w-full items-center gap-2 rounded-md bg-zinc-800/40 px-3 py-2 text-left text-sm text-zinc-200' +
              (onItemClick ? ' hover:bg-zinc-800/70' : ' cursor-default')
            }
          >
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.trailing}
          </button>
        ))
      )}
      <button
        type="button"
        onClick={onOpenList}
        className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-600/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
      >
        {rest > 0 ? `alle ${total} in Listenansicht öffnen` : 'in Listenansicht öffnen'}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
