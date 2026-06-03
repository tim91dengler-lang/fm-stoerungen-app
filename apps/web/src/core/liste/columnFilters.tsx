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
import { createPortal } from 'react-dom';
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
(comboboxFilterFn as unknown as { autoRemove?: (v: unknown) => boolean }).autoRemove = (
  v: unknown,
) => !isComboboxValue(v) || (v.pills.length === 0 && v.text === '');

interface ComboboxFilterProps extends RendererProps {
  /** TanStack-Column-Object (wird von PowerListenView durchgereicht).
   *  Bewusst lose typisiert (`unknown` als Row-Type), damit der Filter
   *  page-agnostic in `filterRenderers` einsetzbar ist. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column?: Column<any, unknown>;
  /** Optionale vorgegebene Auswahlliste (Slug→Label). Wenn fehlt: distinct aus Rows. */
  options?: SelectOption[];
  /** Placeholder für das Input-Feld. */
  placeholder?: string;
}

/**
 * Standard-Filter für alle PowerListenView-Spalten.
 *
 * UX (Tim, Runde 3):
 * - Slot in der Spalte ist kompakt + neutral: nur ChevronDown + optional „N"-Counter.
 *   KEINE Pills oder Werte inline sichtbar.
 * - Klick auf den Slot öffnet ein Dropdown mit:
 *     • Such-Input oben (free-text, Live-Suche)
 *     • Checkbox-Liste der distinct-Werte (aus options oder column.getFacetedUniqueValues)
 *     • „Auswahl löschen"-Link wenn ≥1 ausgewählt
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
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current: ComboboxFilterValue = isComboboxValue(value)
    ? value
    : { pills: [], text: '' };

  const activeCount = current.pills.length + (current.text !== '' ? 1 : 0);

  // Close on outside click + on scroll/resize. Das Dropdown wird per Portal mit
  // fixed-Position gerendert (sonst schneidet der overflow-Container der Liste
  // es ab); bei Scroll/Resize wäre die Position stale → schließen.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (!containerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  // Distinct values for the dropdown list. Prefer explicit `options` (with
  // labels) over rows-derived faceted values.
  // WICHTIG: bereits ausgewählte Pills bleiben sichtbar (mit ✓), nicht
  // rausfiltern — sonst können sie nicht mehr entfernt werden.
  const dropdownItems = useMemo<SelectOption[]>(() => {
    const lcText = current.text.toLowerCase();
    if (options && options.length > 0) {
      return options.filter(
        (o) =>
          current.text === '' ||
          o.label.toLowerCase().includes(lcText) ||
          o.value.toLowerCase().includes(lcText),
      );
    }
    if (!column) return [];
    const faceted = column.getFacetedUniqueValues?.();
    if (!faceted) return [];
    const items: SelectOption[] = [];
    for (const [raw] of faceted) {
      const val = raw === null || raw === undefined ? '' : String(raw);
      if (val === '') continue;
      if (current.text !== '' && !val.toLowerCase().includes(lcText)) continue;
      items.push({ value: val, label: val });
    }
    items.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    return items;
  }, [column, options, current.text]);

  function emit(next: ComboboxFilterValue) {
    if (next.pills.length === 0 && next.text === '') {
      onChange(undefined);
    } else {
      onChange(next);
    }
  }

  function togglePill(v: string) {
    const has = current.pills.includes(v);
    const nextPills = has ? current.pills.filter((p) => p !== v) : [...current.pills, v];
    emit({ pills: nextPills, text: current.text });
  }

  function setText(t: string) {
    emit({ pills: current.pills, text: t });
  }

  function clearAll() {
    emit({ pills: [], text: '' });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 392));
      setPos({ top: r.bottom + 4, left, minWidth: r.width });
    }
    setOpen(true);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={`flex w-full items-center justify-between gap-1 rounded border px-2 py-0.5 text-xs font-normal normal-case ${
          open
            ? 'border-emerald-500/50 bg-zinc-950 ring-1 ring-emerald-500/40'
            : activeCount > 0
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-zinc-700 bg-zinc-950 text-zinc-500'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {activeCount === 0 ? placeholder : `${activeCount} ausgewählt`}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              minWidth: pos.minWidth,
            }}
            onClick={(e) => e.stopPropagation()}
            className="z-50 max-h-72 w-max max-w-sm overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            <div className="border-b border-zinc-800 p-1">
              <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5">
                <Search className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  value={current.text}
                  onChange={(e) => setText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="filtern oder tippen …"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAll();
                    }}
                    className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    title="Filter löschen"
                    aria-label="Alle Filter löschen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {dropdownItems.length === 0 ? (
                <div className="px-2 py-1 text-[11px] text-zinc-500">
                  {current.text !== '' ? 'Keine Treffer' : 'Keine Werte verfügbar'}
                </div>
              ) : (
                dropdownItems.slice(0, 100).map((o) => {
                  const checked = current.pills.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        togglePill(o.value);
                      }}
                      className={`flex w-full items-center gap-2 truncate px-2 py-1 text-left text-xs ${
                        checked
                          ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                          : 'text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                            : 'border-zinc-600'
                        }`}
                        aria-hidden
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards-compatible legacy filters
// ---------------------------------------------------------------------------

/**
 * TextFilter — Alias auf ComboboxFilter (Runde 3, Tim wollte einheitliches
 * Pattern überall: compact Slot + Dropdown statt freies Text-Input).
 *
 * Pages, die explizit `TextFilter` importieren, bekommen jetzt das neue
 * Pattern automatisch. Der Free-Text-Anteil bleibt erhalten — er steht
 * im Dropdown-Such-Input, nicht mehr direkt in der Spalte.
 */
export const TextFilter = ComboboxFilter;

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
 * SelectFilter — wrappt jetzt ComboboxFilter. Backwards-Compat-Bridge:
 * Aufrufer geben weiterhin `options` durch und erhalten dieselbe UX wie
 * ComboboxFilter (compact Slot + Dropdown), statt Buttons inline.
 *
 * Das alte Value-Format (string[]) wird automatisch in das ComboboxValue-
 * Format konvertiert.
 */
export function SelectFilter({
  value,
  onChange,
  options,
}: RendererProps & { options: SelectOption[] }): ReactNode {
  const pills: string[] = Array.isArray(value)
    ? (value as string[])
    : isComboboxValue(value)
      ? value.pills
      : [];

  return (
    <ComboboxFilter
      value={{ pills, text: '' }}
      onChange={(v) => {
        if (v === undefined) {
          onChange(undefined);
          return;
        }
        if (isComboboxValue(v)) {
          // Map back to legacy string[] shape so existing TanStack
          // arrIncludesSome filterFn keeps working.
          onChange(v.pills.length > 0 ? v.pills : undefined);
        }
      }}
      options={options}
    />
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
          onClick={() => onChange(s === 'yes' ? true : s === 'no' ? false : undefined)}
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
