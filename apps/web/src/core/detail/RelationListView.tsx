import { useMemo, useState } from 'react';

/**
 * Verknüpfungs-Liste als **Inline-Reiter** (Master-Layout-Standard §5.5, Reiter-
 * Modell): vorgefilterte Liste + Suche, direkt im Detail-Overlay (kein gestapeltes
 * Fenster, kein „zurück"). Zeilen sind klickbar (`onRowClick` → Ziel-Detail).
 *
 * Bewusst schlank gehalten und für den Reiter-Kontext gedacht; für sehr große
 * Mengen kommt perspektivisch die volle `PowerListenView` hier rein (server-/
 * seitenweises Laden). Heute reicht client-seitige Suche, weil Verknüpfungen auf
 * den Datensatz vorgefiltert (= klein) sind.
 */
export interface RelationColumn {
  key: string;
  label: string;
}
export interface RelationRow {
  id: string;
  /** Durchsuchbarer Text der Zeile (lowercase-Vergleich). */
  search: string;
  cells: React.ReactNode[];
}

export function RelationListView({
  columns,
  rows,
  total,
  searchPlaceholder,
  onRowClick,
  emptyLabel = 'Keine Einträge.',
  loading = false,
}: {
  columns: RelationColumn[];
  rows: RelationRow[];
  /** Gesamtanzahl (Default = rows.length). */
  total?: number;
  searchPlaceholder?: string;
  onRowClick?: (id: string) => void;
  emptyLabel?: string;
  loading?: boolean;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => (q ? rows.filter((r) => r.search.toLowerCase().includes(q.toLowerCase())) : rows),
    [rows, q],
  );
  const gesamt = total ?? rows.length;
  // Wenn die Liste serverseitig gekappt wurde (mehr Datensätze als geladen),
  // durchsucht die Client-Suche nur die geladenen Zeilen → ehrlich kennzeichnen,
  // statt einen total zu versprechen, der gar nicht durchsuchbar ist.
  const truncated = gesamt > rows.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-5 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder ?? `🔎 in ${rows.length} Einträgen suchen …`}
          className="w-full max-w-sm rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600"
        />
        <span className="ml-auto text-xs text-zinc-500">
          {`${filtered.length} / ${truncated ? `${rows.length} geladen (von ${gesamt})` : gesamt}`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-sm text-zinc-500">Lädt …</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r.id) : undefined}
                  className={
                    'border-b border-zinc-800/60 ' +
                    (onRowClick ? 'cursor-pointer hover:bg-zinc-800/40' : '')
                  }
                >
                  {r.cells.map((cell, i) => (
                    <td key={i} className="px-4 py-2.5 text-zinc-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-6 text-center text-sm text-zinc-600"
                  >
                    {q ? 'Keine Treffer.' : emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
