import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ListChecks, MapPin, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { adresseApi } from '../api/endpoints';
import type { AdresseRead } from '../api/types';

interface AdresseSearchSelectProps {
  selected: AdresseRead | null;
  onChange: (next: AdresseRead | null) => void;
  className?: string;
}

const SEARCH_MIN_LEN = 2;
const SEARCH_LIMIT = 20;
const BROWSE_PAGE_SIZE = 50;
const DEBOUNCE_MS = 250;

function fmtAdresse(a: AdresseRead): string {
  const haus = a.hausnummer ? ` ${a.hausnummer}` : '';
  return `${a.strasse}${haus}, ${a.plz} ${a.ort}`;
}

/**
 * Adress-Picker mit Server-Side-Suche und Browse-Modal.
 *
 * Folgt der R6a-Pattern-Konvention (siehe PartnerSearchSelect): Such-Input mit
 * Browse-Icon links im Feld, Klick öffnet ein scrollbares Pop-up-Modal mit
 * paginierter Liste aller Adressen.
 */
export function AdresseSearchSelect({
  selected,
  onChange,
  className,
}: AdresseSearchSelectProps) {
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
    queryKey: ['adresse-search', debouncedQuery],
    queryFn: () => adresseApi.list({ search: debouncedQuery, limit: SEARCH_LIMIT }),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  function pick(a: AdresseRead) {
    onChange(a);
    setRawQuery('');
    inputRef.current?.blur();
  }

  const hits = searchQuery.data?.items ?? [];

  return (
    <div className={clsx('flex flex-col', className)}>
      <label className="mb-1 block text-xs font-medium text-zinc-300">
        Adresse
      </label>

      {selected && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-sm">
          <span className="flex items-center gap-2 text-emerald-200">
            <MapPin className="h-3.5 w-3.5" />
            {fmtAdresse(selected)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md p-0.5 text-emerald-300 hover:bg-emerald-500/20"
            aria-label="Auswahl entfernen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setBrowseOpen(true)}
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300"
          title="Alle Adressen durchsuchen"
          aria-label="Adressen-Liste öffnen"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Adresse suchen … (Straße, PLZ, Ort)"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {(rawQuery.length > 0 || searchQuery.isFetching) && (
        <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-1">
          {!searchEnabled ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Mindestens 2 Zeichen eingeben.
            </p>
          ) : searchQuery.isFetching ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">Suche …</p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Keine Treffer für „{debouncedQuery}&ldquo;.
            </p>
          ) : (
            hits.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <MapPin className="h-3 w-3 text-zinc-500" />
                <span className="truncate">{fmtAdresse(a)}</span>
              </button>
            ))
          )}
        </div>
      )}

      {browseOpen && (
        <AdresseBrowseModal
          onPick={(a) => {
            pick(a);
            setBrowseOpen(false);
          }}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </div>
  );
}

function AdresseBrowseModal({
  onPick,
  onClose,
}: {
  onPick: (a: AdresseRead) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filter]);

  const browseQuery = useInfiniteQuery({
    queryKey: ['adresse-browse', debouncedFilter],
    queryFn: ({ pageParam }) =>
      adresseApi.list({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-w-lg flex-col rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <ListChecks className="h-4 w-4 text-emerald-400" /> Adresse auswählen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="In Liste filtern (optional) …"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-2 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {browseQuery.isLoading ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              Lade Adressen …
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              Keine Adressen vorhanden.
            </p>
          ) : (
            <>
              <ul className="space-y-0.5">
                {hits.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onPick(a)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{fmtAdresse(a)}</span>
                    </button>
                  </li>
                ))}
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
            {hits.length} von {total} Adressen
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
