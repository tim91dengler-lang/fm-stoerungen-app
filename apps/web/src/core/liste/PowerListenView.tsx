import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Columns3, Layers, Search } from 'lucide-react';

export interface PowerListenViewProps<TData> {
  /** Eindeutiger View-Key (z. B. 'tickets', 'adressen') — wird für gespeicherte Ansichten verwendet. */
  viewKey: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  /** Globale Volltextsuche-Funktion (Backend-Filter); wird oben in der Toolbar gerendert. */
  search: string;
  onSearchChange: (search: string) => void;
  visibility: VisibilityState;
  onVisibilityChange: (state: VisibilityState) => void;
  sorting: SortingState;
  onSortingChange: (state: SortingState) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (state: ColumnFiltersState) => void;
  /** Reihenfolge der Spalten (Drag-Reorder). Wenn leer, gilt die Default-Reihenfolge aus `columns`. */
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  /** Slot für rechts in der Toolbar (z. B. "Neu"-Button). */
  toolbarRight?: ReactNode;
  /** Slot für gespeicherte Ansichten links in der Toolbar. */
  toolbarLeft?: ReactNode;
  /** Total-Anzeige (z. B. "12 von 100 Treffer"). */
  count?: { filtered: number; total: number };
  /** Pro Spalte ein optionaler Filter-Renderer; wird unter dem Header gerendert. */
  filterRenderers?: Record<
    string,
    (props: { value: unknown; onChange: (v: unknown) => void }) => ReactNode
  >;
  /** Wenn gesetzt: Bulk-Select-Checkbox-Spalte wird gerendert + Toolbar-Banner bei Auswahl. */
  enableRowSelection?: boolean;
  /** Eindeutige Row-Id für Selection-State (default: nutzt TanStack-Default index, was nicht stabil ist). */
  getRowId?: (row: TData) => string;
  /** Aktueller Selection-State (wird benötigt, wenn enableRowSelection=true). */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (state: RowSelectionState) => void;
  /** Bulk-Aktionen, gerendert wenn min. 1 Row selected ist. Bekommt die ausgewählten Rows. */
  bulkActions?: (selectedRows: TData[]) => ReactNode;
  /** Gruppierung (mehrstufig). Wenn leer = keine Gruppierung. */
  grouping?: GroupingState;
  onGroupingChange?: (state: GroupingState) => void;
  /** Welche Spalten dürfen als Gruppe genutzt werden (default: alle leaf-Columns außer __select__). */
  groupableColumns?: { id: string; label: string }[];
  /** Placeholder für das globale Suchfeld. */
  searchPlaceholder?: string;
  /** Slot für ein zusätzliches Filter-Panel (z. B. „Filter (3)"-Button mit Dropdown). */
  filterButton?: ReactNode;
  /** Footer-Text unter der Tabelle (z. B. „5 Tickets · sortiert nach Erstellt ↓"). */
  showFooter?: boolean;
  /** Singular/Plural-Bezeichnung für die Footer-Anzeige. */
  itemLabel?: { singular: string; plural: string };
}

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
  columnOrder,
  onColumnOrderChange,
  toolbarRight,
  toolbarLeft,
  count,
  filterRenderers,
  enableRowSelection = false,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  bulkActions,
  grouping = [],
  onGroupingChange,
  groupableColumns,
  searchPlaceholder = 'Suche …',
  filterButton,
  showFooter = false,
  itemLabel,
}: PowerListenViewProps<TData>) {
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // Bei enableRowSelection eine Spezial-Spalte für Checkbox vorne dranhängen
  const allColumns = useMemo<ColumnDef<TData>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectCol: ColumnDef<TData> = {
      id: '__select__',
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Alle auswählen"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Zeile auswählen"
        />
      ),
    };
    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  // Dropdown beim Außerhalb-Klick schließen
  useEffect(() => {
    if (!showColumnPicker) return;
    function handler(e: MouseEvent) {
      if (!columnPickerRef.current?.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPicker]);
  useEffect(() => {
    if (!showGroupPicker) return;
    function handler(e: MouseEvent) {
      if (!groupPickerRef.current?.contains(e.target as Node)) {
        setShowGroupPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupPicker]);

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnVisibility: visibility,
      columnFilters,
      columnOrder: columnOrder.length > 0 ? columnOrder : undefined,
      rowSelection: rowSelection ?? {},
      grouping,
    },
    enableMultiSort: true,
    enableSortingRemoval: true, // 3. Klick auf Header → Sortierung entfernen
    isMultiSortEvent: (e) => (e as React.MouseEvent).shiftKey,
    enableRowSelection,
    enableGrouping: true,
    autoResetExpanded: false,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    onSortingChange: (updater) =>
      onSortingChange(typeof updater === 'function' ? updater(sorting) : updater),
    onColumnVisibilityChange: (updater) =>
      onVisibilityChange(
        typeof updater === 'function' ? updater(visibility) : updater,
      ),
    onColumnFiltersChange: (updater) =>
      onColumnFiltersChange(
        typeof updater === 'function' ? updater(columnFilters) : updater,
      ),
    onColumnOrderChange: (updater) =>
      onColumnOrderChange(
        typeof updater === 'function' ? updater(columnOrder) : updater,
      ),
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) return;
      onRowSelectionChange(
        typeof updater === 'function' ? updater(rowSelection ?? {}) : updater,
      );
    },
    onGroupingChange: (updater) => {
      if (!onGroupingChange) return;
      onGroupingChange(
        typeof updater === 'function' ? updater(grouping) : updater,
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const hasColumnFilters = columnFilters.length > 0;
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((r) => r.original)
    : [];

  // Drag & Drop: Reorder via HTML5 D&D auf den th-Headers
  function onDragStart(colId: string, e: React.DragEvent<HTMLDivElement>) {
    setDraggingCol(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function onDrop(targetColId: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const sourceColId = e.dataTransfer.getData('text/plain') || draggingCol;
    setDraggingCol(null);
    if (!sourceColId || sourceColId === targetColId) return;
    // __select__-Spalte bleibt immer vorne
    if (sourceColId === '__select__' || targetColId === '__select__') return;

    const currentOrder =
      columnOrder.length > 0
        ? columnOrder
        : table.getAllLeafColumns().map((c) => c.id);
    const fromIdx = currentOrder.indexOf(sourceColId);
    const toIdx = currentOrder.indexOf(targetColId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...currentOrder];
    const [moved] = next.splice(fromIdx, 1);
    if (moved === undefined) return;
    next.splice(toIdx, 0, moved);
    onColumnOrderChange(next);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex items-center gap-2">{toolbarLeft}</div>
        <div className="relative min-w-[18rem] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>
        {filterButton}
        <div className="relative" ref={columnPickerRef}>
          <button
            type="button"
            onClick={() => setShowColumnPicker((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Spalten ({visibleLeafColumns.filter((c) => c.id !== '__select__').length})
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
              {table
                .getAllLeafColumns()
                .filter((col) => col.id !== '__select__')
                .map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
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
        {onGroupingChange && groupableColumns && groupableColumns.length > 0 && (
          <div className="relative" ref={groupPickerRef}>
            <button
              type="button"
              onClick={() => setShowGroupPicker((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${
                grouping.length > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Gruppieren nach …"
            >
              <Layers className="h-3.5 w-3.5" />
              {grouping.length === 0
                ? 'Gruppieren'
                : `Gruppiert: ${
                    groupableColumns.find((g) => g.id === grouping[0])?.label ??
                    grouping[0]
                  }${grouping.length > 1 ? ` +${grouping.length - 1}` : ''}`}
            </button>
            {showGroupPicker && (
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    onGroupingChange([]);
                    setShowGroupPicker(false);
                  }}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                    grouping.length === 0
                      ? 'bg-zinc-800 text-emerald-300'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Keine Gruppierung
                </button>
                <div className="my-1 border-t border-zinc-800" />
                {groupableColumns.map((g) => {
                  const idx = grouping.indexOf(g.id);
                  const active = idx >= 0;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          onGroupingChange(
                            grouping.filter((x) => x !== g.id),
                          );
                        } else {
                          onGroupingChange([...grouping, g.id]);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                        active
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{g.label}</span>
                      {active && (
                        <span className="font-mono text-[10px] text-emerald-300">
                          {idx + 1}.
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {sorting.length > 0 && (
          <button
            type="button"
            onClick={() => onSortingChange([])}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Sortierung zurücksetzen"
          >
            Sort zurück
          </button>
        )}
        {hasColumnFilters && (
          <button
            type="button"
            onClick={() => onColumnFiltersChange([])}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
          >
            Spalten-Filter zurücksetzen
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {count && (
            <span className="text-xs text-zinc-500">
              {count.filtered === count.total
                ? `${count.total} Treffer`
                : `${count.filtered} von ${count.total} Treffer`}
            </span>
          )}
          {toolbarRight}
        </div>
      </div>

      {enableRowSelection && selectedRows.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <span>
            <strong>{selectedRows.length}</strong> ausgewählt
            <button
              type="button"
              onClick={() => onRowSelectionChange?.({})}
              className="ml-3 text-xs underline hover:no-underline"
            >
              Auswahl aufheben
            </button>
          </span>
          {bulkActions && (
            <div className="flex items-center gap-2">{bulkActions(selectedRows)}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;
                  const canSort = header.column.getCanSort();
                  const sortIdx = sorting.findIndex((s) => s.id === colId);
                  const sortDir = header.column.getIsSorted();
                  // Drag-Reorder temporär deaktiviert (Tim 2026-05-23) —
                  // Verdacht dass draggable-Header in Chromium den Maus-Event-Loop blockiert.
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const isDraggable = false;
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 align-top font-medium ${
                        draggingCol === colId ? 'opacity-50' : ''
                      }`}
                    >
                      <div
                        draggable={isDraggable}
                        onDragStart={(e) => isDraggable && onDragStart(colId, e)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(colId, e)}
                        onDragEnd={() => setDraggingCol(null)}
                        className="flex items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={
                            canSort
                              ? (e) => header.column.toggleSorting(undefined, e.shiftKey)
                              : undefined
                          }
                          className={`flex items-center gap-1 ${
                            canSort ? 'cursor-pointer hover:text-zinc-100' : ''
                          }`}
                          title={
                            canSort
                              ? 'Klick = sortieren · Shift+Klick = Multi-Sort · 3. Klick = aus'
                              : undefined
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortDir === 'asc' && <span aria-hidden>▲</span>}
                          {sortDir === 'desc' && <span aria-hidden>▼</span>}
                          {sorting.length > 1 && sortIdx >= 0 && (
                            <sup className="ml-0.5 text-[10px] text-zinc-400">
                              {sortIdx + 1}
                            </sup>
                          )}
                        </button>
                      </div>
                      {(() => {
                        const renderer = filterRenderers?.[colId];
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
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleLeafColumns.length}
                  className="px-3 py-8 text-center text-zinc-500"
                >
                  Keine Treffer.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                return (
                  <GroupRow
                    key={row.id}
                    row={row}
                    colSpan={visibleLeafColumns.length}
                    groupableColumns={groupableColumns}
                  />
                );
              }
              return (
                <tr
                  key={row.id}
                  className={`border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-800/40 ${
                    row.getIsSelected() ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {showFooter && (
          <FooterRow
            count={table.getRowModel().rows.filter((r) => !r.getIsGrouped()).length}
            sorting={sorting}
            allColumns={table.getAllLeafColumns()}
            itemLabel={itemLabel}
          />
        )}
      </div>
    </div>
  );
}

function FooterRow<TData>({
  count,
  sorting,
  allColumns,
  itemLabel,
}: {
  count: number;
  sorting: SortingState;
  allColumns: ReturnType<
    ReturnType<typeof useReactTable<TData>>['getAllLeafColumns']
  >;
  itemLabel?: { singular: string; plural: string };
}) {
  const label = itemLabel ?? { singular: 'Eintrag', plural: 'Einträge' };
  const noun = count === 1 ? label.singular : label.plural;
  const sortPart =
    sorting.length === 0
      ? ''
      : ` · sortiert nach ${sorting
          .map((s) => {
            const col = allColumns.find((c) => c.id === s.id);
            const headerStr =
              typeof col?.columnDef.header === 'string'
                ? col.columnDef.header
                : s.id;
            return `${headerStr} ${s.desc ? '↓' : '↑'}`;
          })
          .join(', ')}`;
  return (
    <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-500">
      {count} {noun}
      {sortPart}
    </div>
  );
}

function GroupRow<TData>({
  row,
  colSpan,
  groupableColumns,
}: {
  row: Row<TData>;
  colSpan: number;
  groupableColumns?: { id: string; label: string }[];
}) {
  const value = row.groupingValue;
  const colId = row.groupingColumnId;
  const colLabel =
    groupableColumns?.find((g) => g.id === colId)?.label ?? colId;
  const valueText =
    value === '' || value === null || value === undefined
      ? '— (leer)'
      : String(value);
  return (
    <tr className="border-y border-zinc-800 bg-zinc-900/70">
      <td
        colSpan={colSpan}
        className="px-3 py-2"
      >
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          className="flex w-full items-center gap-2 text-left text-sm text-zinc-200 hover:text-zinc-50"
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          )}
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {colLabel}:
          </span>
          <span className="font-medium">{valueText}</span>
          <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {row.subRows.length}
          </span>
        </button>
      </td>
    </tr>
  );
}
