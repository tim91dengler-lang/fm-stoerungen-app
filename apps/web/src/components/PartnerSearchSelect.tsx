import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Check, ListChecks, X } from 'lucide-react';
import clsx from 'clsx';
import { partnerApi } from '../api/endpoints';
import type { PartnerMini } from '../api/types';
import { usePartnerTypLookup } from '../lib/usePartnerTypLookup';

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
 * Pattern (verbindlich für künftige Auswahl-Felder, Tim R6):
 * - Such-Input mit Browse-Icon **links im Feld** (nicht daneben)
 * - Klick auf Browse-Icon öffnet ein scrollbares Pop-up-Modal mit
 *   paginierter Liste aller Optionen
 * - Tippen ins Feld zeigt Inline-Dropdown mit Suche (ab 2 Zeichen)
 *
 * Geeignet für tausende Einträge — kein Vorab-Load.
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
  const partnerTypLookup = usePartnerTypLookup();
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const searchEnabled = debouncedQuery.length >= SEARCH_MIN_LEN;

  const searchQuery = useQuery({
    queryKey: ['partner-search', debouncedQuery],
    queryFn: () => partnerApi.list({ search: debouncedQuery, limit: SEARCH_LIMIT }),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const selectedSet = useMemo(
    () => new Set(selected.map((p) => p.id)),
    [selected],
  );

  function add(p: PartnerMini) {
    if (selectedSet.has(p.id)) return;
    onChange([...selected, p]);
  }

  function addAndFocus(p: PartnerMini) {
    add(p);
    setRawQuery('');
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id));
  }

  const hits = searchQuery.data?.items ?? [];

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

      <div className="relative">
        <button
          type="button"
          onClick={() => setBrowseOpen(true)}
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300"
          title="Alle Geschäftspartner durchsuchen"
          aria-label="Geschäftspartner-Liste öffnen"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {(rawQuery.length > 0 || searchQuery.isFetching) && (
        <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-1">
          {!searchEnabled ? (
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
                    isChecked ? remove(p.id) : addAndFocus({ id: p.id, name: p.name })
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
                      {p.typen
                        .map((t) => partnerTypLookup.labelFor(t))
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {browseOpen && (
        <PartnerBrowseModal
          roleLabel={roleLabel}
          tone={tone}
          selectedSet={selectedSet}
          onAdd={add}
          onRemove={remove}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Browse-Modal — scrollbare paginierte Liste aller Partner
// ============================================================================

interface PartnerBrowseModalProps {
  roleLabel: string;
  tone: NonNullable<PartnerSearchSelectProps['tone']>;
  selectedSet: Set<string>;
  onAdd: (p: PartnerMini) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function PartnerBrowseModal({
  roleLabel,
  tone,
  selectedSet,
  onAdd,
  onRemove,
  onClose,
}: PartnerBrowseModalProps) {
  const toneClasses = TONE_CLASSES[tone];
  const partnerTypLookup = usePartnerTypLookup();
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filter]);

  const browseQuery = useInfiniteQuery({
    queryKey: ['partner-browse', debouncedFilter],
    queryFn: ({ pageParam }) =>
      partnerApi.list({
        limit: BROWSE_PAGE_SIZE,
        offset: pageParam,
        search: debouncedFilter || undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    staleTime: 30_000,
  });

  const hits = useMemo(
    () => browseQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [browseQuery.data],
  );
  const total = browseQuery.data?.pages[0]?.total ?? 0;

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-browse-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-w-lg flex-col rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2
            id="partner-browse-title"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-100"
          >
            <ListChecks className="h-4 w-4 text-emerald-400" />
            {roleLabel} auswählen
            <span className="text-xs font-normal text-zinc-500">
              ({selectedSet.size} ausgewählt)
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 px-4 py-3">
          <input
            type="text"
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="In Liste filtern (optional) …"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {browseQuery.isLoading ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              Lade Geschäftspartner …
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              {debouncedFilter
                ? `Keine Treffer für „${debouncedFilter}".`
                : 'Keine Geschäftspartner angelegt.'}
            </p>
          ) : (
            <>
              <ul className="space-y-0.5">
                {hits.map((p) => {
                  const isChecked = selectedSet.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() =>
                          isChecked
                            ? onRemove(p.id)
                            : onAdd({ id: p.id, name: p.name })
                        }
                        className={clsx(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                          isChecked
                            ? clsx(toneClasses.checked, toneClasses.checkedHover)
                            : 'text-zinc-200 hover:bg-zinc-800',
                        )}
                      >
                        <span
                          className={clsx(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            isChecked
                              ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                              : 'border-zinc-600',
                          )}
                          aria-hidden
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.typen && p.typen.length > 0 && (
                          <span className="shrink-0 text-[10px] text-zinc-500">
                            {p.typen
                              .map((t) => partnerTypLookup.labelFor(t))
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {browseQuery.hasNextPage && (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => browseQuery.fetchNextPage()}
                    disabled={browseQuery.isFetchingNextPage}
                    className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {browseQuery.isFetchingNextPage ? 'Lade …' : 'Mehr laden'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
          <span>
            {hits.length} von {total} Partner
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
