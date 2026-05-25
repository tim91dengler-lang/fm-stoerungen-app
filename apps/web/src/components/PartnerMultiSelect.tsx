import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import clsx from 'clsx';

interface PartnerOption {
  id: string;
  name: string;
  typen?: string[];
}

interface PartnerMultiSelectProps {
  /** All available partners (modal filters them locally by `typFilter`). */
  partner: PartnerOption[];
  /** Currently selected partner IDs. */
  selected: string[];
  /** Called when selection changes. */
  onChange: (ids: string[]) => void;
  /** Optional: only show partners that include this typ in `typen` (e.g. 'mieter'). */
  typFilter?: string;
  /** Empty-state hint when filtered partner list is empty. */
  emptyHint?: string;
  /** Optional label for the search input placeholder. */
  searchPlaceholder?: string;
  /** Display label for the role — used in headings + pills. */
  roleLabel: string;
  /** Color theme for the pills. Default: emerald. */
  tone?: 'emerald' | 'amber' | 'violet';
  /** Optional className for the outer container. */
  className?: string;
}

const TONE_CLASSES: Record<
  NonNullable<PartnerMultiSelectProps['tone']>,
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

/**
 * Wiederverwendbarer Multi-Select für Partner-IDs.
 *
 * Pattern: Pills oben für ausgewählte Partner, Such-Input darunter,
 * Liste der filterbaren Partner mit Checkbox. Wird in HausModal /
 * StockwerkModal / EinheitModal für Eigentümer + Mieter eingesetzt.
 */
export function PartnerMultiSelect({
  partner,
  selected,
  onChange,
  typFilter,
  emptyHint,
  searchPlaceholder = 'Suchen …',
  roleLabel,
  tone = 'emerald',
  className,
}: PartnerMultiSelectProps) {
  const [search, setSearch] = useState('');
  const toneClasses = TONE_CLASSES[tone];
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const base = typFilter
      ? partner.filter((p) => p.typen?.includes(typFilter))
      : partner;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => p.name.toLowerCase().includes(q));
  }, [partner, typFilter, search]);

  const selectedPartner = useMemo(
    () => partner.filter((p) => selectedSet.has(p.id)),
    [partner, selectedSet],
  );

  // Clear search when selection changes (smoother UX).
  useEffect(() => {
    if (search) setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.length]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className={clsx('flex flex-col', className)}>
      <label className="mb-1 block text-xs font-medium text-zinc-300">
        {roleLabel} ({selectedPartner.length} ausgewählt)
      </label>

      {selectedPartner.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedPartner.map((p) => (
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
                onClick={() => toggle(p.id)}
                className="rounded-full p-0.5 hover:bg-zinc-700/30"
                aria-label={`${p.name} entfernen`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/30 p-1">
        {partner.length === 0 || (typFilter && filtered.length === 0 && !search) ? (
          <p className="px-2 py-3 text-center text-xs text-zinc-500">
            {emptyHint ?? 'Keine Partner verfügbar.'}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-zinc-500">
            Keine Treffer für „{search}&ldquo;.
          </p>
        ) : (
          filtered.map((p) => {
            const isChecked = selectedSet.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
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
                <span className="truncate">{p.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
