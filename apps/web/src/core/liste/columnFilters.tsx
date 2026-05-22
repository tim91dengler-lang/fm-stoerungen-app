/* Wiederverwendbare Filter-Komponenten für PowerListenView.filterRenderers.
 *
 * Konvention:
 * - TextFilter: enthält-Filter (case-insensitive)
 * - NumberFilter: `>=` (kleinster Wert)
 * - SelectFilter: Multi-Select via Tag-Pills (für Auswahllisten-Slug-Felder)
 * - ToggleFilter: drei-Zustand (alle / nur ja / nur nein)
 *
 * Alle Renderer arbeiten mit dem TanStack-`value`/`onChange`-Protokoll
 * von `setFilterValue`. Die zugehörige `filterFn` ist die TanStack-Default-
 * `auto`/`includesString`/`weakEquals` — d. h. die Spalte muss eine sinnvolle
 * `accessorFn` haben, die den filterbaren Wert liefert.
 */

import { type ReactNode } from 'react';

interface RendererProps {
  value: unknown;
  onChange: (v: unknown) => void;
}

export function TextFilter({ value, onChange }: RendererProps): ReactNode {
  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder="filtern …"
      className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs font-normal normal-case text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function NumberFilter({ value, onChange }: RendererProps): ReactNode {
  return (
    <input
      type="number"
      value={(value as number) ?? ''}
      onChange={(e) =>
        onChange(e.target.value === '' ? undefined : Number(e.target.value))
      }
      placeholder="≥"
      className="w-16 rounded border border-slate-300 px-2 py-0.5 text-xs font-normal normal-case text-slate-700 focus:border-brand-500 focus:outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectFilter({
  value,
  onChange,
  options,
}: RendererProps & { options: SelectOption[] }): ReactNode {
  const selected = (value as string[]) ?? [];
  function toggle(v: string) {
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : [...selected, v];
    onChange(next.length > 0 ? next : undefined);
  }
  return (
    <div
      className="flex flex-wrap gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-normal normal-case ${
            selected.includes(o.value)
              ? 'bg-emerald-500 text-zinc-950'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleFilter({ value, onChange }: RendererProps): ReactNode {
  // value === true/false/undefined
  const state =
    value === true ? 'yes' : value === false ? 'no' : 'all';
  return (
    <div
      className="inline-flex overflow-hidden rounded border border-zinc-700 text-[10px] font-normal normal-case"
      onClick={(e) => e.stopPropagation()}
    >
      {(['all', 'yes', 'no'] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() =>
            onChange(s === 'yes' ? true : s === 'no' ? false : undefined)
          }
          className={`px-1.5 py-0.5 ${
            state === s
              ? 'bg-emerald-500 text-zinc-950'
              : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          {s === 'all' ? '·' : s === 'yes' ? '✓' : '✗'}
        </button>
      ))}
    </div>
  );
}

/* TanStack-`filterFns` Helfer:
 * `arrIncludesSome` ist eingebaut und passt für SelectFilter (Mehrfachauswahl
 * gegen Single-Value-Spalte). `>=` für NumberFilter muss eine custom-fn sein
 * (siehe greaterOrEqualFilter unten).
 */

export const greaterOrEqualFilter = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: unknown,
): boolean => {
  if (filterValue === undefined || filterValue === null) return true;
  const cellValue = row.getValue(columnId);
  if (typeof cellValue !== 'number') return true;
  return cellValue >= (filterValue as number);
};

export const booleanEqualsFilter = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: unknown,
): boolean => {
  if (filterValue === undefined || filterValue === null) return true;
  return row.getValue(columnId) === filterValue;
};
