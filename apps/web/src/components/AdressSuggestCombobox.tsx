import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adresseApi } from '../api/endpoints';
import type { AdresseSuggestion } from '../api/types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AdresseSuggestion) => void;
  placeholder?: string;
  country?: string;
}

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function AdressSuggestCombobox({
  value,
  onChange,
  onSelect,
  placeholder = 'Straße, Hausnummer, Ort tippen …',
  country = 'de',
}: Props) {
  const debouncedQuery = useDebounced(value, 300);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestQuery = useQuery({
    queryKey: ['adress-suggest', debouncedQuery, country],
    queryFn: () => adresseApi.suggest(debouncedQuery, country),
    enabled: debouncedQuery.trim().length >= 3,
    staleTime: 60_000,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = suggestQuery.data ?? [];

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        autoComplete="off"
      />
      {open && debouncedQuery.length >= 3 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-lg">
          {suggestQuery.isLoading && (
            <div className="px-3 py-2 text-xs text-zinc-500">Suche …</div>
          )}
          {!suggestQuery.isLoading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">
              Keine Treffer. Bitte manuell eintragen.
            </div>
          )}
          {suggestions.map((s, idx) => (
            <button
              type="button"
              key={`${s.label}-${idx}`}
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-900/50"
            >
              <span className="font-medium text-zinc-200">
                {s.strasse}
                {s.hausnummer ? ` ${s.hausnummer}` : ''}
              </span>
              <span className="ml-2 text-zinc-500">
                {s.plz} {s.ort} {s.land ? `· ${s.land}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
