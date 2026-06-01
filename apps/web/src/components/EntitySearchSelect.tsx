import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

export interface SearchOption {
  id: string;
  label: string;
  /** Optional secondary text shown muted on the right. */
  hint?: string | null;
}

interface EntitySearchSelectProps {
  /** Currently selected id (form state is id-based). */
  value: string | null;
  /** Fired with the new id (or null when cleared). */
  onChange: (id: string | null, option: SearchOption | null) => void;
  /** Server-side search — returns up to ~20 matches. Empty query may browse first page. */
  fetcher: (search: string) => Promise<SearchOption[]>;
  /** react-query cache namespace, must be unique per field/context. */
  queryKey: string;
  /** Label for a preset value whose option isn't in the search results yet (detail/edit). */
  initialLabel?: string | null;
  /** Resolve the label for a preset id when no initialLabel is known (rare; e.g. defaults). */
  loadLabel?: (id: string) => Promise<string | null>;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  id?: string;
  className?: string;
}

const DEBOUNCE_MS = 250;

/**
 * Single-select picker mit Server-Side-Search — für Bewegungsdaten-Felder mit
 * tausenden bis hunderttausenden Einträgen (Geschäftspartner, Objekte, Projekte).
 *
 * Beim Öffnen wird die erste Seite (~20) geladen, danach debounced gefiltert —
 * nicht leer, aber tippbar. Anders als das Multi-Select `PartnerSearchSelect`
 * liefert/erwartet diese Komponente genau einen Wert und ist über einen
 * austauschbaren `fetcher` für jede Entität nutzbar.
 */
export function EntitySearchSelect({
  value,
  onChange,
  fetcher,
  queryKey,
  initialLabel = null,
  loadLabel,
  placeholder = 'Suchen …',
  disabled = false,
  allowClear = true,
  id,
  className,
}: EntitySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Label of the current value — kept locally so a preset id renders without a list hit.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLabel);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync preset label when the parent supplies one (e.g. detail panel: t.objekt.name).
  useEffect(() => {
    if (initialLabel != null) setSelectedLabel(initialLabel);
  }, [initialLabel]);

  // Resolve the label for a preset id when only the id is known.
  useEffect(() => {
    if (!value) {
      setSelectedLabel(null);
      return;
    }
    if (selectedLabel != null) return;
    if (!loadLabel) return;
    let cancelled = false;
    loadLabel(value).then((lbl) => {
      if (!cancelled && lbl != null) setSelectedLabel(lbl);
    });
    return () => {
      cancelled = true;
    };
  }, [value, selectedLabel, loadLabel]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Close on outside click + ESC; focus input when opening.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    const focus = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
      clearTimeout(focus);
    };
  }, [open]);

  // Beim Öffnen direkt die erste Seite laden (Browse), auch ohne Eingabe — nicht
  // leer, aber tippend filterbar (Tim 2026-06-01). Bei 1 Zeichen wird ebenfalls
  // schon gesucht; der Server liefert je nur ~20 Treffer → günstig.
  const searchEnabled = open;

  const searchQuery = useQuery({
    queryKey: ['entity-search', queryKey, debouncedQuery],
    queryFn: () => fetcher(debouncedQuery),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const hits = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  function select(opt: SearchOption) {
    setSelectedLabel(opt.label);
    onChange(opt.id, opt);
    setRawQuery('');
    setOpen(false);
  }

  function clear() {
    setSelectedLabel(null);
    onChange(null, null);
    setRawQuery('');
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50',
          value ? 'text-zinc-100' : 'text-zinc-500',
        )}
      >
        <span className="flex-1 truncate">
          {value ? (selectedLabel ?? '…') : placeholder}
        </span>
        {value && allowClear && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Auswahl entfernen"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="relative border-b border-zinc-800 p-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {searchQuery.isFetching ? (
              <p className="px-2 py-3 text-center text-xs text-zinc-500">Suche …</p>
            ) : hits.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-zinc-500">
                {debouncedQuery ? `Keine Treffer für „${debouncedQuery}“.` : 'Keine Einträge.'}
              </p>
            ) : (
              hits.map((opt) => {
                const isSel = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => select(opt)}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                      isSel
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-zinc-200 hover:bg-zinc-800',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                        isSel ? 'border-emerald-400 bg-emerald-500 text-zinc-950' : 'border-zinc-600',
                      )}
                      aria-hidden
                    >
                      {isSel && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="shrink-0 text-[10px] text-zinc-500">{opt.hint}</span>
                    )}
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
