import clsx from 'clsx';

import type { UUID } from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';

interface Props {
  value: UUID[];
  onChange: (next: UUID[]) => void;
  lookup: PartnerTypLookup;
  /** Wenn `true`: nur Anzeige (Read-only-Mode), keine Klicks. */
  readOnly?: boolean;
}

/**
 * Multi-Select-Chips für die `partner_typ`-Auswahlliste.
 *
 * - Read-only: zeigt nur die ausgewählten Werte als Pills.
 * - Edit: zeigt alle aus der Auswahlliste — bereits selektierte sind
 *   farbig hervorgehoben, Klick toggled.
 */
export function TypenMultiSelect({ value, onChange, lookup, readOnly = false }: Props) {
  if (readOnly) {
    if (value.length === 0) {
      return <span className="text-xs text-zinc-500">— keine —</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((id) => {
          const label = lookup.labelFor(id);
          if (!label) return null;
          return (
            <span
              key={id}
              className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  const toggle = (id: UUID) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {lookup.werte.map((w) => {
        const active = value.includes(w.id);
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => toggle(w.id)}
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
              active
                ? 'bg-emerald-500 text-zinc-950'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
            )}
          >
            {w.label}
          </button>
        );
      })}
      {lookup.werte.length === 0 && (
        <span className="text-xs text-zinc-500">
          Keine Typen in der Auswahlliste — bitte unter Stammdaten → Auswahllisten
          pflegen.
        </span>
      )}
    </div>
  );
}
