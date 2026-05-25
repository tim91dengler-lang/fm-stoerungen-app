/* Wiederverwendbare Filter-Komponenten für PowerListenView.filterRenderers.
 *
 * Konvention:
 * - ComboboxFilter: Pills (Multi-Select OR) + Free-Text-Input (contains AND).
 *   Dropdown zeigt distinct-Werte aus den aktuell sichtbaren Rows.
 *   ist der neue Standard-Filter für alle Spalten — ersetzt TextFilter und SelectFilter.
 * - TextFilter / SelectFilter: bleiben als Backwards-Compat-Aliase bzw. Wrapper
 *   bestehen, damit alte Pages weiterhin ohne Änderung funktionieren.
 * - NumberFilter: `>=` (kleinster Wert)
 * - ToggleFilter: drei-Zustand (alle / nur ja / nur nein)
 *
 * Alle Renderer arbeiten mit dem TanStack-`value`/`onChange`-Protokoll von
 * `setFilterValue`. Der ComboboxFilter erwartet zusätzlich `column` (für
 * `getFacetedUniqueValues()`) und ggf. eine custom `filterFn` (siehe
 * `comboboxFilterFn` unten). Für TextFilter/SelectFilter bleibt die jeweilige
 * Default-/`arrIncludesSome`-filterFn aus TanStack.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { Column, Row } from '@tanstack/react-table';

interface RendererProps {
  value: unknown;
  onChange: (v: unknown) => void;
}

export interface SelectOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// ComboboxFilter
// ---------------------------------------------------------------------------

/**
 * Value-Shape, die der ComboboxFilter über `setFilterValue` schreibt.
 *
 * - `pills`: exakt-Werte (Multi-Select, OR untereinander).
 * - `text`: free-text contains, case-insensitive.
 *
 * Wenn beide leer sind, wird `undefined` zurückgegeben (TanStack-Konvention:
 * undefined = kein Filter aktiv).
 */
export interface ComboboxFilterValue {
  pills: string[];
  text: string;
}

function isComboboxValue(v: unknown): v is ComboboxFilterValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { pills?: unknown }).pills) &&
    typeof (v as { text?: unknown }).text === 'string'
  );
}

/**
 * Custom filterFn für den ComboboxFilter.
 *
 * Logik:
 *   row matched WENN
 *     (pills.length === 0 || pills.includes(rowValue))   // exact match
 *     UND
 *     (text === '' || rowValue.toLowerCase().includes(text.toLowerCase()))  // contains
 *
 * `rowValue` wird über `row.getValue(columnId)` geholt — funktioniert für
 * `accessorKey`- und `accessorFn`-Spalten gleichermaßen.
 */
export const comboboxFilterFn = (
  row: Row<unknown>,
  columnId: string,
  filterValue: unknown,
): boolean => {
  if (!isComboboxValue(filterValue)) return true;
  const { pills, text } = filterValue;
  if (pills.length === 0 && text === '') return true;

  const raw = row.getValue(columnId);
  const cellStr = raw === null || raw === undefined ? '' : String(raw);

  if (pills.length > 0 && !pills.includes(cellStr)) return false;
  if (text !== '' && !cellStr.toLowerCase().includes(text.toLowerCase())) {
    return false;
  }
  return true;
};
// TanStack ruft `resolveFilterValue`/`autoRemove` optional an der filterFn
// auf. Wir setzen einen no-op `autoRemove`, damit der Filter nicht bei
// `{ pills: [], text: '' }` automatisch entfernt wird, bevor unser onChange
// sauber `undefined` zurückgibt — sonst flackert die Pill kurz nach.
(comboboxFilterFn as unknown as { autoRemove?: (v: unknown) => boolean }).autoRemove =
  (v: unknown) =>
    !isComboboxValue(v) || (v.pills.length === 0 && v.text === '');

interface ComboboxFilterProps extends RendererProps {
  /** TanStack-Column-Object (wird von PowerListenView durchgereicht). */
  column?: Column<unknown, unknown>;
  /** Optionale vorgegebene Auswahlliste (Slug→Label). Wenn fehlt: distinct aus Rows. */
  options?: SelectOption[];
  /** Placeholder für das Input-Feld. */
  placeholder?: string;
}

/**
 * Standard-Filter für alle PowerListenView-Spalten.
 *
 * - Eingabefeld oben (free-text, Live-Suche).
 * - Selected Pills inline im Eingabefeld (mit ✕).
 * - ChevronDown-Icon rechts → klappt Dropdown auf.
 * - Dropdown zeigt distinct Werte der Spalte (aus options oder
 *   `column.getFacetedUniqueValues()`); klick → wird zur Pill.
 * - Dropdown schließt bei Click-Outside.
 */
export function ComboboxFilter({
  value,
  onChange,
  column,
  options,
  placeholder = 'filtern …',
}: ComboboxFilterProps): ReactNode {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current: ComboboxFilterValue = isComboboxValue(value)
    ? value
    : { pills: [], text: '' };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Distinct values for the dropdown list. Prefer explicit `options` (with
  // labels) over rows-derived faceted values.
  const dropdownItems = useMemo<SelectOption[]>(() => {
    if (options && options.length > 0) {
      // Filter out already-selected pills + apply free-text live-search.
      return options.filter(
        (o) =>
          !current.pills.includes(o.value) &&
          (current.text === '' ||
            o.label.toLowerCase().includes(current.text.toLowerCase()) ||
            o.value.toLowerCase().includes(current.text.toLowerCase())),
      );
    }
    if (!column) return [];
    // Fallback: distinct values from currently visible rows.
    const faceted = column.getFacetedUniqueValues?.();
    if (!faceted) return [];
    const items: SelectOption[] = [];
    for (const [raw] of faceted) {
      const val = raw === null || raw === undefined ? '' : String(raw);
      if (val === '') continue;
      if (current.pills.includes(val)) continue;
      if (
        current.text !== '' &&
        !val.toLowerCase().includes(current.text.toLowerCase())
      ) {
        continue;
      }
      items.push({ value: val, label: val });
    }
    items.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    return items;
  }, [column, options, current.pills, current.text]);

  function emit(next: ComboboxFilterValue) {
    if (next.pills.length === 0 && next.text === '') {
      onChange(undefined);
    } else {
      onChange(next);
    }
  }

  function addPill(v: string) {
    if (current.pills.includes(v)) return;
    emit({ pills: [...current.pills, v], text: '' });
    // Re-focus the input so the user can keep typing / picking.
    inputRef.current?.focus();
  }

  function removePill(v: string) {
    emit({ pills: current.pills.filter((p) => p !== v), text: current.text });
  }

  function setText(t: string) {
    emit({ pills: current.pills, text: t });
  }

  // Labels for pills: if we have `options`, map value→label. Otherwise show value.
  function labelFor(v: string): string {
    if (options) {
      const found = options.find((o) => o.value === v);
      if (found) return found.label;
    }
    return v;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-normal normal-case ${
          open
            ? 'border-emerald-500/50 bg-zinc-950 ring-1 ring-emerald-500/40'
            : 'border-zinc-700 bg-zinc-950'
        }`}
      >
        <Search className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {current.pills.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300"
            >
              <span className="max-w-[8rem] truncate">{labelFor(p)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePill(p);
                }}
                className="rounded p-0.5 hover:bg-emerald-500/30"
                title="Entfernen"
                aria-label={`Filter „${labelFor(p)}" entfernen`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={current.text}
            onChange={(e) => {
              setText(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={current.pills.length === 0 ? placeholder : ''}
            className="min-w-[3rem] flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            if (!open) inputRef.current?.focus();
          }}
          className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title={open ? 'Liste schließen' : 'Liste öffnen'}
          aria-label="Auswahlliste öffnen"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-2xl">
          {dropdownItems.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-zinc-500">
              {current.text !== '' || current.pills.length > 0
                ? 'Keine weiteren Treffer'
                : 'Keine Werte verfügbar'}
            </div>
          ) : (
            dropdownItems.slice(0, 50).map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  // Use mousedown so click-outside doesn't fire before us.
                  e.preventDefault();
                  addPill(o.value);
                }}
                className="block w-full truncate px-2 py-1 text-left text-xs text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards-compatible legacy filters
// ---------------------------------------------------------------------------

/**
 * TextFilter — kompatibel zu bestehender Page-Verwendung.
 *
 * Old shape: filter value is a plain string used with TanStack `includesString`.
 * Pages that still import `TextFilter` keep working unchanged. Für neue Pages
 * bitte `ComboboxFilter` nutzen.
 */
export function TextFilter({ value, onChange }: RendererProps): ReactNode {
  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder="filtern …"
      className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs font-normal normal-case text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
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
      className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs font-normal normal-case text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/**
 * SelectFilter — bleibt für Backwards-Compat erhalten. Pages, die explizit
 * `options` durchgeben, nutzen weiter den alten Multi-Pill-Button-Style.
 * Für neue Spalten bitte stattdessen direkt `ComboboxFilter` mit `options`
 * verwenden.
 */
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
  const state = value === true ? 'yes' : value === false ? 'no' : 'all';
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
 * (siehe greaterOrEqualFilter unten). Für den ComboboxFilter siehe
 * `comboboxFilterFn` oben.
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
