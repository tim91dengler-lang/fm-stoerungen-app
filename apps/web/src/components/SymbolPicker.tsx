import clsx from 'clsx';
import { ICON_SLUGS, type IconSlug, iconFor } from './TickettypIcon';

interface Props {
  value: string | null;
  onChange: (slug: IconSlug) => void;
}

/**
 * 15-Icon-Picker für Vorlagen-Designer (Spec §5.5).
 * Rendert die 15 lucide-Icon-Slugs als Grid.
 */
export function SymbolPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ICON_SLUGS.map((slug) => {
        const Icon = iconFor(slug);
        const selected = value === slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onChange(slug)}
            aria-label={`Symbol ${slug}`}
            aria-pressed={selected}
            className={clsx(
              'flex h-9 items-center justify-center rounded-md border transition-colors',
              selected
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400'
                : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
