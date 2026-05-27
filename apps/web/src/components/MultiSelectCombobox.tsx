import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional farbe-slug (z. B. 'blue', 'amber') für Chip-Tone. */
  farbe?: string | null;
}

interface Props {
  /** Auswahl als Array von value-Strings (UUIDs / Slugs). */
  value: string[];
  onChange: (next: string[]) => void;
  options: ComboboxOption[];
  /** Platzhalter im geschlossenen Zustand, wenn nichts ausgewählt ist. */
  placeholder?: string;
  /** Größe / Auftritt. */
  size?: 'sm' | 'md';
  /** Zeige (n) Hinweis statt einer langen Liste, wenn mehr als limit gewählt. */
  pillLimit?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Wiederverwendbare Multi-Select-Combobox.
 *
 * - Geschlossener Zustand zeigt die selektierten Werte als Chips (jede mit X
 *   zum Einzel-Abwählen) plus Pfeil. Klick öffnet die Liste.
 * - Offener Zustand: Suchfeld + scrollbare Liste, jede Zeile toggled
 *   on/off. Mehrfach-Auswahl ohne Reload.
 * - Schließt bei Klick außerhalb und Escape.
 */
export function MultiSelectCombobox({
  value,
  onChange,
  options,
  placeholder = 'Auswählen …',
  size = 'md',
  pillLimit = 4,
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const labelByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const needle = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, search]);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const removeOne = (v: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((x) => x !== v));
  };

  const sizeCls =
    size === 'sm' ? 'min-h-[28px] px-1.5 py-1 text-xs' : 'min-h-[34px] px-2 py-1.5 text-sm';

  return (
    <div className={clsx('relative', className)} ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={clsx(
          'flex w-full items-center justify-between gap-1 rounded-md border bg-zinc-950 text-left text-zinc-100 transition-colors',
          sizeCls,
          disabled
            ? 'cursor-not-allowed border-zinc-800 opacity-60'
            : 'border-zinc-700 hover:border-zinc-600 focus:border-emerald-500',
          open && 'border-emerald-500',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex flex-wrap gap-1">
          {value.length === 0 && (
            <span className="text-zinc-500">{placeholder}</span>
          )}
          {value.slice(0, pillLimit).map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-200"
            >
              {labelByValue.get(v) ?? v.slice(0, 8)}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeOne(v, e)}
                  aria-label="Entfernen"
                  className="rounded p-0.5 hover:bg-emerald-500/30"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
          {value.length > pillLimit && (
            <span className="inline-flex items-center rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
              +{value.length - pillLimit}
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-800 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen …"
              autoFocus
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">
                Keine Treffer.
              </div>
            ) : (
              filtered.map((o) => {
                const isChecked = value.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={clsx(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                      isChecked
                        ? 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                        : 'text-zinc-200 hover:bg-zinc-800',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                        isChecked
                          ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                          : 'border-zinc-600',
                      )}
                      aria-hidden
                    >
                      {isChecked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
