import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { partnerApi } from '../api/endpoints';

/** Aus einem Such-Treffer für den Autofill der Wartet-Kontaktfelder benötigt. */
export interface PartnerKontaktAuswahl {
  id: string;
  name: string;
  ansprechpartner: string | null;
  telefon: string | null;
  mobil: string | null;
  email: string | null;
}

interface PartnerKontaktPickerProps {
  /** Aktuell gesetzter Partner (id + Anzeigename) oder null. */
  value: { id: string; name: string } | null;
  /** Bei Auswahl eines Partners — Caller füllt Kontaktfelder + setzt die ID. */
  onSelect: (partner: PartnerKontaktAuswahl) => void;
  /** Auswahl entfernen (setzt nur die Partner-ID zurück). */
  onClear: () => void;
  placeholder?: string;
}

const SEARCH_MIN_LEN = 2;
const DEBOUNCE_MS = 250;

/**
 * Single-Select-Geschäftspartner-Picker mit Server-Side-Search (auch bei 500+
 * Partnern). Für die Wartet-Kontakt-Auswahl am Ticket: ist ein Partner gewählt,
 * wird er als Chip mit „entfernen" gezeigt; sonst ein Such-Feld mit Type-ahead.
 * Durchsucht ALLE Geschäftspartner (nicht nur Nachunternehmer).
 */
export function PartnerKontaktPicker({
  value,
  onSelect,
  onClear,
  placeholder = 'Geschäftspartner suchen …',
}: PartnerKontaktPickerProps) {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const searchEnabled = debouncedQuery.length >= SEARCH_MIN_LEN;
  const search = useQuery({
    queryKey: ['partner-kontakt-search', debouncedQuery],
    queryFn: () => partnerApi.list({ search: debouncedQuery, limit: 20 }),
    enabled: searchEnabled,
    staleTime: 30_000,
  });
  const hits = search.data?.items ?? [];

  if (value) {
    return (
      <div className="mt-0.5 flex items-center justify-between rounded-md border border-amber-500/30 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100">
        <span className="truncate">{value.name}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-2 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Auswahl entfernen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-0.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-amber-500/30 bg-zinc-900 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
        />
      </div>
      {(rawQuery.length > 0 || search.isFetching) && (
        <div className="mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          {!searchEnabled ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Mindestens 2 Zeichen eingeben.
            </p>
          ) : search.isFetching ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">Suche …</p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-2 text-center text-xs text-zinc-500">
              Keine Treffer für „{debouncedQuery}“.
            </p>
          ) : (
            hits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect({
                    id: p.id,
                    name: p.name,
                    ansprechpartner: p.ansprechpartner,
                    telefon: p.telefon,
                    mobil: p.mobil,
                    email: p.email,
                  });
                  setRawQuery('');
                }}
                className="flex w-full flex-col gap-0.5 rounded px-2 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <span className="truncate font-medium">{p.name}</span>
                {(p.ansprechpartner || p.telefon || p.email) && (
                  <span className="truncate text-[10px] text-zinc-500">
                    {[p.ansprechpartner, p.telefon, p.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
