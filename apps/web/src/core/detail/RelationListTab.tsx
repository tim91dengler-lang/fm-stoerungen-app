import { useMemo, useState } from 'react';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

import { ComboboxFilter } from '../liste/columnFilters';
import { PowerListenView } from '../liste/PowerListenView';

/**
 * Verknüpfungs-Reiter mit der **echten `PowerListenView`** (Master-Layout-Standard,
 * Tim-Entscheidung 2026-06-02): vorgefilterte Liste mit Volltextsuche,
 * Spaltenfiltern, Multi-Sort, Spalten ein/aus — inline im Detail-Overlay. Kapselt
 * den gesamten Listen-State, sodass ein Modul nur Spalten + Daten liefert.
 *
 * Daten kommen vorgefiltert auf den Datensatz (= kleine Teilmenge) als Array rein;
 * die Liste arbeitet clientseitig. Globale Volltextsuche filtert über
 * `getSearchText`; Spaltenfilter laufen über TanStack. Standard-Baustein für ALLE
 * Module — siehe Memory `detail-felder-keine-nativen-controls`.
 */
export function RelationListTab<T>({
  viewKey,
  columns,
  data,
  getSearchText,
  onRowClick,
  searchPlaceholder,
  loading = false,
  itemLabel,
  total,
  headerAction,
}: {
  viewKey: string;
  columns: ColumnDef<T>[];
  data: T[];
  /** Liefert den durchsuchbaren Text einer Zeile (globale Volltextsuche, clientseitig). */
  getSearchText?: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  itemLabel?: { singular: string; plural: string };
  /** Gesamtanzahl (Default = data.length); für „N von M". */
  total?: number;
  /** Optionale Aktion (z. B. „+ Neu"-Button) oberhalb der Liste, rechtsbündig. */
  headerAction?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!search.trim() || !getSearchText) return data;
    const q = search.toLowerCase();
    return data.filter((r) => getSearchText(r).toLowerCase().includes(q));
  }, [data, search, getSearchText]);

  // Jede Spalte bekommt den Standard-Combobox-Spaltenfilter (Pills + Freitext +
  // distinct-Werte). Module müssen die Filter nicht einzeln verdrahten.
  const filterRenderers = useMemo(() => {
    const m: Record<string, typeof ComboboxFilter> = {};
    for (const c of columns) {
      const id = c.id ?? (c as { accessorKey?: string }).accessorKey;
      if (id) m[id] = ComboboxFilter;
    }
    return m;
  }, [columns]);

  if (loading) {
    return <div className="p-8 text-sm text-zinc-500">Lädt …</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2">
      {headerAction && (
        <div className="mb-2 flex shrink-0 justify-end">{headerAction}</div>
      )}
      <PowerListenView<T>
        viewKey={viewKey}
        columns={columns}
        data={filtered}
        search={search}
        onSearchChange={setSearch}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        filterRenderers={filterRenderers}
        onRowClick={onRowClick}
        searchPlaceholder={searchPlaceholder ?? 'Volltextsuche …'}
        count={{ filtered: filtered.length, total: total ?? data.length }}
        showFooter
        itemLabel={itemLabel}
        polish={{
          stickyHeader: true,
          stickyMaxHeight: 'calc(85vh - 15rem)',
          consolidatedSettingsMenu: true,
        }}
      />
    </div>
  );
}
