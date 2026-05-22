import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';

export interface PowerListenViewProps<TData> {
  /** Eindeutiger View-Key (z. B. 'tickets', 'adressen') — wird für gespeicherte Ansichten verwendet. */
  viewKey: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  /** Globale Volltextsuche-Funktion (Backend-Filter); wird oben in der Toolbar gerendert. */
  search: string;
  onSearchChange: (search: string) => void;
  /** Sichtbare Spalten-IDs; ungenutzt wenn `null` (TanStack initial defaults). */
  visibility: VisibilityState | null;
  onVisibilityChange: (state: VisibilityState) => void;
  sorting: SortingState;
  onSortingChange: (state: SortingState) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (state: ColumnFiltersState) => void;
  /** Slot für rechts in der Toolbar (z. B. "Neu"-Button). */
  toolbarRight?: ReactNode;
  /** Slot für gespeicherte Ansichten links in der Toolbar. */
  toolbarLeft?: ReactNode;
  /** Total-Anzeige (z. B. "12 von 100 Treffer"). */
  count?: { filtered: number; total: number };
  /** Pro Spalte ein optionaler Filter-Renderer. Bekommt id + aktuellen Wert. */
  filterRenderers?: Record<
    string,
    (props: {
      value: unknown;
      onChange: (v: unknown) => void;
    }) => ReactNode
  >;
}

export type ViewMode = 'liste' | 'kachel';

export function PowerListenView<TData>({
  columns,
  data,
  search,
  onSearchChange,
  visibility,
  onVisibilityChange,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  toolbarRight,
  toolbarLeft,
  count,
  filterRenderers,
}: PowerListenViewProps<TData>) {
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility: visibility ?? {},
      columnFilters,
    },
    onSortingChange: (updater) =>
      onSortingChange(
        typeof updater === 'function' ? updater(sorting) : updater,
      ),
    onColumnVisibilityChange: (updater) =>
      onVisibilityChange(
        typeof updater === 'function'
          ? updater(visibility ?? {})
          : updater,
      ),
    onColumnFiltersChange: (updater) =>
      onColumnFiltersChange(
        typeof updater === 'function' ? updater(columnFilters) : updater,
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const hasColumnFilters = columnFilters.length > 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">{toolbarLeft}</div>
        <input
          type="search"
          placeholder="Suche …"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-[14rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnPicker((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Spalten ({visibleLeafColumns.length})
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              {table.getAllLeafColumns().map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {typeof col.columnDef.header === 'string'
                    ? col.columnDef.header
                    : col.id}
                </label>
              ))}
            </div>
          )}
        </div>
        {hasColumnFilters && (
          <button
            type="button"
            onClick={() => onColumnFiltersChange([])}
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Spalten-Filter zurücksetzen
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {count && (
            <span className="text-xs text-slate-500">
              {count.filtered === count.total
                ? `${count.total} Treffer`
                : `${count.filtered} von ${count.total} Treffer`}
            </span>
          )}
          {toolbarRight}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2 font-medium align-top"
                    >
                      <button
                        type="button"
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={`flex items-center gap-1 ${canSort ? 'cursor-pointer hover:text-slate-900' : ''}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sortDir === 'asc' && <span>▲</span>}
                        {sortDir === 'desc' && <span>▼</span>}
                      </button>
                      {(() => {
                        const renderer = filterRenderers?.[header.column.id];
                        if (!renderer) return null;
                        return (
                          <div className="mt-1">
                            {renderer({
                              value: header.column.getFilterValue(),
                              onChange: (v) => header.column.setFilterValue(v),
                            })}
                          </div>
                        );
                      })()}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleLeafColumns.length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Keine Treffer.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
