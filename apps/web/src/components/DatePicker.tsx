import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Gestylter Datums-Picker (dark/zinc/emerald-Theme) — ersetzt das native
 * `<input type=date>`, dessen Kalender-Icon im Dark-Mode kaum sichtbar ist und
 * das je Browser anders aussieht. Wert ist ein ISO-Datum `YYYY-MM-DD` (ohne
 * Zeitzone). Klick öffnet einen Monats-Kalender; Pfeiltasten navigieren, Enter
 * wählt, Esc schließt.
 */
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
const fmtDisplay = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : null);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** Mo=0 … So=6 */
const monFirstWeekday = (d: Date) => (d.getDay() + 6) % 7;

export function DatePicker({
  value,
  onChange,
  placeholder = 'Datum wählen …',
  allowClear = true,
  disabled = false,
  className,
}: {
  value?: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseIso(value), [value]);
  const today = useMemo(() => new Date(), []);
  // Angezeigter Monat + fokussierter Tag (für Tastatur-Navigation).
  const [view, setView] = useState(() => selected ?? today);
  const [focus, setFocus] = useState(() => selected ?? today);

  useEffect(() => {
    if (open) {
      const base = selected ?? today;
      setView(base);
      setFocus(base);
    }
  }, [open, selected, today]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    const t = setTimeout(() => gridRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('mousedown', onClick);
      clearTimeout(t);
    };
  }, [open]);

  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = monFirstWeekday(firstOfMonth);
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  function pick(d: Date) {
    onChange(toIso(d));
    setOpen(false);
  }
  function shiftFocus(deltaDays: number) {
    const next = new Date(focus);
    next.setDate(next.getDate() + deltaDays);
    setFocus(next);
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }
  function onGridKey(e: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      shiftFocus(moves[e.key]!);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(focus);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-left text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50',
          value ? 'text-zinc-100' : 'text-zinc-500',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="flex-1 truncate">{value ? fmtDisplay(value) : placeholder}</span>
        {value && allowClear && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Datum entfernen"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-md border border-zinc-800 bg-zinc-900 p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Voriger Monat"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Nächster Monat"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-zinc-500">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div
            ref={gridRef}
            role="grid"
            tabIndex={0}
            onKeyDown={onGridKey}
            className="grid grid-cols-7 gap-0.5 outline-none"
          >
            {cells.map((d, i) =>
              d === null ? (
                <span key={`x${i}`} />
              ) : (
                <button
                  key={toIso(d)}
                  type="button"
                  onClick={() => pick(d)}
                  className={clsx(
                    'flex h-8 items-center justify-center rounded text-xs',
                    selected && sameDay(d, selected)
                      ? 'bg-emerald-500 font-medium text-zinc-950'
                      : sameDay(d, focus)
                        ? 'bg-zinc-800 text-zinc-100 ring-1 ring-emerald-500/50'
                        : 'text-zinc-300 hover:bg-zinc-800',
                    !(selected && sameDay(d, selected)) &&
                      sameDay(d, today) &&
                      'font-semibold text-emerald-300',
                  )}
                >
                  {d.getDate()}
                </button>
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="rounded px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
            >
              Heute
            </button>
            {allowClear && value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
