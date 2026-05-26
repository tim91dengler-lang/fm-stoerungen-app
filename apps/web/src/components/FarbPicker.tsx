import clsx from 'clsx';
import { Check } from 'lucide-react';
import { FARB_SLUGS, type FarbSlug, farbeDotClass } from './TickettypFarbe';

interface Props {
  value: string | null;
  onChange: (slug: FarbSlug) => void;
}

/**
 * 8-Farben-Picker für Vorlagen-Designer (Spec §5.4).
 * Rendert die 8 Tailwind-Farb-Slugs als runde Buttons.
 */
export function FarbPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FARB_SLUGS.map((slug) => {
        const selected = value === slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onChange(slug)}
            aria-label={`Farbe ${slug}`}
            aria-pressed={selected}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-full transition-all',
              farbeDotClass(slug),
              selected
                ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-900'
                : 'opacity-70 hover:opacity-100',
            )}
          >
            {selected && <Check className="h-4 w-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
