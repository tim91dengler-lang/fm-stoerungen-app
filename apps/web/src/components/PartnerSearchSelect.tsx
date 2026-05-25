import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Check, ListChecks, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { partnerApi } from '../api/endpoints';
import type { PartnerMini } from '../api/types';

interface PartnerSearchSelectProps {
  /** Already selected partners (id + name) — rendered as pills. */
  selected: PartnerMini[];
  /** Fired when the selection changes. Receives the full PartnerMini[] so caller
   *  can keep names + ids in sync without an extra lookup. */
  onChange: (next: PartnerMini[]) => void;
  /** Role label shown in the header (e.g. "Eigentümer", "Mieter"). */
  roleLabel: string;
  /** Color theme for pills + checked rows. */
  tone?: 'emerald' | 'amber' | 'violet';
  /** Optional placeholder for the search input. */
  searchPlaceholder?: string;
  /** Show this hint when search is empty. */
  emptyHint?: string;
  /** Optional outer className. */
  className?: string;
}

const TONE_CLASSES: Record<
  NonNullable<PartnerSearchSelectProps['tone']>,
  { pill: string; checked: string; checkedHover: string }
> = {
  emerald: {
    pill: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    checked: 'bg-emerald-500/15 text-emerald-200',
    checkedHover: 'hover:bg-emerald-500/25',
  },
  amber: {
    pill: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    checked: 'bg-amber-500/15 text-amber-200',
    checkedHover: 'hover:bg-amber-500/25',
  },
  violet: {
    pill: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
    checked: 'bg-violet-500/15 text-violet-200',
    checkedHover: 'hover:bg-violet-500/25',
  },
};

const SEARCH_MIN_LEN = 2;
const SEARCH_LIMIT = 20;
const BROWSE_PAGE_SIZE = 50;
const DEBOUNCE_MS = 250;

/**
 * Partner picker mit Server-Side-Search.
 *
 * Pattern: Pills oben (bereits ausgewählt), Such-Input darunter, Treffer-Dropdown.
 * Suche erst ab {@link SEARCH_MIN_LEN} Zeichen, mit 250 ms Debounce, max
 * {@link SEARCH_LIMIT} Treffer. Keine clientseitige Filterung der gesamten Partner-
 * Tabelle — geeignet für Tausende von Geschäftspartnern.
 */
export function PartnerSearchSelect({
  selected,
  onChange,
  roleLabel,
  tone = 'emerald',
  searchPlaceholder = 'Geschäftspartner suchen …',
  emptyHint = 'Mindestens 2 Zeichen eingeben.',
  className,
}: PartnerSearchSelectProps) {
  const toneClasses = TONE_CLASSES[tone];
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [browseMode, setBrowseMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const searchEnabled =
    !browseMode && debouncedQuery.length >= SEARCH_MIN_LEN;

  const searchQuery = useQuery({
    queryKey: ['partner-search', debouncedQuery],
    queryFn: () => partnerApi.list({ search: debouncedQuery, limit: SEARCH_LIMIT }),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const browseQuery = useInfiniteQuery({
    queryKey: ['partner-browse'],
    queryFn: ({ pageParam }) =>
      partnerApi.list({ limit: BROWSE_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: browseMode,
    staleTime: 30_000,
  });

  const selectedSet = useMemo(
    () => new Set(selected.map((p) => p.id)),
    [selected],
  );

  function add(p: PartnerMini) {
    if (selectedSet.has(p.id)) return;
    onChange([...selected, p]);
    if (!browseMode) {
      setRawQuery('');
      inputRef.current?.focus();
    }
  }

  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id));
  }

  function openBrowse() {
    setBrowseMode(true);
  }

  function closeBrowse() {
    setBrowseMode(false);
  }

  const browseHits = useMemo(
    () => browseQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [browseQuery.data],
  );
  const hits = browseMode ? browseHits : (searchQuery.data?.items ?? []);
  const browseTotal = browseQuery.data?.pages[0]?.total ?? 0;
  const hasMore = browseMode && browseQuery.hasNextPage;

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-xs font-medium text-zinc-300">
          {roleLabel} ({selected.length})
        </label>
      </div>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selected.map((p) => (
            <span
              key={p.id}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                toneClasses.pill,
              )}
            >
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="rounded-full p-0.5 hover:bg-zinc-700/30"
                aria-label={`${p.name} entfernen`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-stretch gap-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={rawQuery}
            onChange={(e) => {
              setRawQuery(e.target.value);
              if (browseMode) closeBrowse();
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={browseMode ? closeBrowse : openBrowse}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
            browseMode
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800',
          )}
          title={browseMode ? 'Browsen schließen' : 'Alle Partner anzeigen'}
        >
          <ListChecks className="h-3.5 w-3.5" />
          {browseMode ? 'Schließen' : 'Alle'}
        </button>
      </div>

      {(browseMode || rawQuery.length > 0 || searchQuery.isFetching) && (
        <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-1">
          {browseMode ? (
            browseQuery.isFetching && hits.length === 0 ? (
              <p className="px-2 py-2 text-center text-xs text-zinc-500">
                Lade Partner …
              </p>
            ) : hits.length === 0 ? (
              <p className="px-2 py-2 text-center text-xs text-zinc-500">
                Keine Geschäftspartner angelegt.
              </p>
            ) : (
              <>
                {hits.map((p) => {
                  const isChecked = selectedSet.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        isChecked ? remove(p.id) : add({ id: p.id, name: p.name })
                      }
                      className={clsx(
                        'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
                        isChecked
                          ? clsx(toneClasses.checked, toneClasses.checkedHover)
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
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.typen && p.typen.length > 0 && (
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {p.typen.join(', ')}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-500">
                  <span>
                    {hits.length} von {browseTotal} Partner
                  </span>
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => browseQuery.fetchNextPage()}
                      disabled={browseQuery.isFetchingNextPage}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {browseQuery.isFetchingNextPage ? 'Lade …' : 'Mehr laden'}
                    </button>
                  )}
                </div>
              </>
            )
          ) : !searchEnabled ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              {emptyHint}
            </p>
          ) : searchQuery.isFetching ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Suche …
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Keine Treffer für „{debouncedQuery}&ldquo;.
            </p>
          ) : (
            hits.map((p) => {
              const isChecked = selectedSet.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    isChecked ? remove(p.id) : add({ id: p.id, name: p.name })
                  }
                  className={clsx(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
                    isChecked
                      ? clsx(toneClasses.checked, toneClasses.checkedHover)
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
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.typen && p.typen.length > 0 && (
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {p.typen.join(', ')}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
