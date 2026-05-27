import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { comboboxFilterFn } from './columnFilters';
import { ConfirmDialog } from './ConfirmDialog';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Columns3,
  Layers,
  Pause,
  Pencil,
  Pin,
  Play,
  Rows3,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';

// Listen-Power 2.0 (W1) — Opt-in-Polish-Optionen. Pages aktivieren einzelne
// Polish-Verhalten gezielt; ohne polish-Prop bleibt das bisherige Verhalten
// unverändert (Roll-out via W2 auf alle Listen).
export interface ListenPolishOptions {
  /** B1.1: Edit/Delete/Sperren-Icons erst beim Zeilen-Hover sichtbar. */
  actionVisibility?: 'always' | 'hover';
  /** B1.3: Gruppen-Header bleibt beim Scrollen oben sichtbar. */
  stickyGroupHeaders?: boolean;
  /** B1.4: Gruppen-Inhalt sichtbar abgesetzt (Einrückung + Schattierung + dickerer Trenner). */
  groupSeparators?: boolean;
  /** B1.6: Density-Toggle (compact / comfortable / spacious). Persistiert pro viewKey in LocalStorage. */
  densityToggle?: boolean;
  /** B3.3: Spalten/Gruppen/Density in einem Zahnrad-Popover statt drei Buttons. */
  consolidatedSettingsMenu?: boolean;
  /** B3.5: `/` fokussiert die Volltextsuche (außerhalb von Eingabefeldern). */
  searchShortcut?: boolean;
}

type Density = 'compact' | 'comfortable' | 'spacious';
const DENSITY_VALUES: Density[] = ['compact', 'comfortable', 'spacious'];
const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Kompakt',
  comfortable: 'Komfort',
  spacious: 'Luftig',
};

// Tailwind-Klassen pro Density für die zentralen Layout-Stellen. Body-Cell,
// Header-Cell und GroupRow folgen demselben Schritt — sonst „springt" die
// Tabelle bei Toggle.
const DENSITY_BODY_TD: Record<Density, string> = {
  compact: 'px-3 py-1',
  comfortable: 'px-3 py-2',
  spacious: 'px-3 py-3.5',
};
const DENSITY_GROUP_TD: Record<Density, string> = {
  compact: 'px-3 py-1.5',
  comfortable: 'px-3 py-2',
  spacious: 'px-3 py-3',
};

function densityStorageKey(viewKey: string): string {
  return `fm-list-density:${viewKey}`;
}

function readDensity(viewKey: string): Density {
  if (typeof window === 'undefined') return 'comfortable';
  try {
    const raw = window.localStorage.getItem(densityStorageKey(viewKey));
    if (raw && (DENSITY_VALUES as string[]).includes(raw)) return raw as Density;
  } catch {
    // LocalStorage kann blockiert sein (Private-Mode / SecurityError) — Fallback.
  }
  return 'comfortable';
}

// Dataset-Mime-Type für Drag-Group: das Drop-Target unterscheidet so
// zwischen Header-Reorder (text/plain) und Group-Drop (text/group-col).
const GROUP_DRAG_MIME = 'text/group-col';

// Stabile Row-Model-Factories — bei TanStack-Table v8 MÜSSEN diese eine
// stabile Reference haben. `getCoreRowModel()` inline aufrufen erzeugt
// bei jedem Render eine neue Factory → internal table-state-update →
// endloser Re-Render-Loop, der den Mainthread blockiert.
const stableCoreRowModel = getCoreRowModel();
const stableSortedRowModel = getSortedRowModel();
const stableFilteredRowModel = getFilteredRowModel();
const stableGroupedRowModel = getGroupedRowModel();
const stableExpandedRowModel = getExpandedRowModel();
const stableFacetedRowModel = getFacetedRowModel();
const stableFacetedUniqueValues = getFacetedUniqueValues();
// Default-FilterFn für alle Spalten ohne explizite Angabe.
// Das aktiviert den ComboboxFilter end-to-end (Pills + Free-Text).
// Spalten, die `filterFn: 'includesString'` / `'arrIncludesSome'` explizit
// setzen (Legacy: Pages mit TextFilter / SelectFilter), behalten ihr Verhalten.
const stableDefaultColumn = { filterFn: comboboxFilterFn };

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
  /** Pro Spalte ein optionaler Filter-Renderer; wird unter dem Header gerendert.
   *
   * Renderer bekommen ergänzend das TanStack-`column` durchgereicht, damit
   * der ComboboxFilter `column.getFacetedUniqueValues()` für seine Dropdown-
   * Liste nutzen kann. Legacy-Renderer (TextFilter/SelectFilter) ignorieren
   * das Feld einfach. */
  filterRenderers?: Record<
    string,
    (props: {
      value: unknown;
      onChange: (v: unknown) => void;
      column: Column<TData, unknown>;
    }) => ReactNode
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
  /** Inline-Mass-Edit pro Spalte. Wird gerendert wenn ≥1 Row selected ist.
   *
   * Pages markieren editierbare Spalten in `columns[i].meta.massEdit`:
   *   meta: { massEdit: { type: 'text' | 'auswahl' | 'boolean'; options?: SelectOption[] } }
   *
   * PowerListenView rendert zwischen Filter-Zeile und Daten eine zusätzliche
   * Edit-Zeile mit passendem Input pro Spalte. `onMassEdit` macht die
   * PATCH-Calls auf die ausgewählten Rows.
   */
  onMassEdit?: (columnId: string, value: unknown, selectedRows: TData[]) => Promise<{ ok: number; failed: number }> | void;
  /**
   * Standard-Aktions-Spalte (Tim R6b-Konvention, erweitert in R6c).
   *
   * Wenn gesetzt, fügt PowerListenView eine fixe Aktions-Spalte direkt nach
   * der Select-Spalte ein (immer links, nicht verschiebbar, nicht filterbar).
   *
   * - `onEdit(row)`: Edit-Flow der Page (typisch Edit-Modal)
   * - `onDelete(rows)`: klassisches Hard-Delete (Mülleimer-Icon).
   *   PowerListenView übergibt single-row Klicks ebenfalls als 1-elementiges
   *   Array, damit der gleiche ConfirmDialog für Single + Bulk verwendet
   *   werden kann.
   * - `sperren`: Soft-Sperre statt Hard-Delete (Pause-Icon).
   *   Pflicht für Partner + Objekt (R6c-Konvention). Schließt onDelete aus —
   *   pro Page nur eines der beiden.
   *
   * Pages bauen damit KEINE eigene `__actions__`-Spalte mehr.
   */
  rowActions?: {
    onEdit?: (row: TData) => void;
    onDelete?: (rows: TData[]) => void;
    sperren?: {
      isGesperrt: (row: TData) => boolean;
      onToggle: (row: TData) => void;
    };
  };
  /** Listen-Power-2.0-Polish (W1). Pro Page einzeln aktivierbar. */
  polish?: ListenPolishOptions;
}

/** Spec für eine spalten-spezifische Mass-Edit-Eingabe.
 *  Liegt in `column.columnDef.meta.massEdit` der einzelnen Spalte.
 */
export interface MassEditSpec {
  /** type:
   *  - 'text': freie Text-Eingabe (Enter = Anwenden)
   *  - 'auswahl': natives <select> für kleine Listen (≤10 Werte)
   *  - 'combobox': searchable Dropdown für viele Werte (FK-Selects, User-Listen)
   *  - 'boolean': Ja/Nein-Buttons
   *  - 'null': nur ein „Auf NULL setzen"-Knopf (z. B. Zuweisung entfernen)
   */
  type: 'text' | 'auswahl' | 'combobox' | 'boolean' | 'null';
  /** Wenn type='auswahl' oder 'combobox': die Auswahlmöglichkeiten. */
  options?: Array<{ value: string; label: string }>;
  /** Optionaler Helper-Text unter dem Input (z. B. „setzt für alle Auswahl"). */
  hint?: string;
}

export function PowerListenView<TData>({
  viewKey,
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
  onMassEdit,
  rowActions,
  polish,
}: PowerListenViewProps<TData>) {
  // Polish-Defaults: ohne polish-Prop bleibt alles wie bisher.
  const polishActionVisibility = polish?.actionVisibility ?? 'always';
  const polishStickyGroupHeaders = polish?.stickyGroupHeaders ?? false;
  const polishGroupSeparators = polish?.groupSeparators ?? false;
  const polishDensityToggle = polish?.densityToggle ?? false;
  const polishConsolidatedMenu = polish?.consolidatedSettingsMenu ?? false;
  const polishSearchShortcut = polish?.searchShortcut ?? false;

  // Density wird nur dann persistiert, wenn der Toggle auch aktiv ist.
  // Sonst bleibt jede Liste in 'comfortable' (heutiges Verhalten).
  const [density, setDensityState] = useState<Density>(() =>
    polishDensityToggle ? readDensity(viewKey) : 'comfortable',
  );
  function setDensity(next: Density) {
    setDensityState(next);
    try {
      window.localStorage.setItem(densityStorageKey(viewKey), next);
    } catch {
      // Persistierung optional — UI-State bleibt sessionintern korrekt.
    }
  }
  const bodyTdClass = DENSITY_BODY_TD[density];
  const groupTdClass = DENSITY_GROUP_TD[density];

  // `/`-Shortcut: fokussiert die Volltextsuche, wenn der User nicht gerade
  // tippt (Input/Textarea/contenteditable werden respektiert).
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!polishSearchShortcut) return;
    function handler(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [polishSearchShortcut]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  // B3.3 konsolidiertes Zahnrad-Menü mit Tabs Spalten | Gruppen | Ansicht.
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    'spalten' | 'gruppen' | 'ansicht'
  >('spalten');
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const [dropZoneHover, setDropZoneHover] = useState(false);
  const [massEditStatus, setMassEditStatus] = useState<string | null>(null);
  const [massEditBusy, setMassEditBusy] = useState<string | null>(null);
  const [massEditConfirm, setMassEditConfirm] = useState<{
    colId: string;
    value: unknown;
    columnLabel: string;
    valueLabel: string;
    count: number;
  } | null>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // Spezial-Spalten vorne anhängen (Tim R6b-Konvention):
  //   [__select__]  ← bei enableRowSelection, Mehrfachauswahl
  //   [__actions__] ← bei rowActions, Edit + Delete fest links
  //   …normale Spalten
  // Beide non-draggable, non-orderable, non-filterable, non-hideable.
  const allColumns = useMemo<ColumnDef<TData>[]>(() => {
    const prefix: ColumnDef<TData>[] = [];
    if (enableRowSelection) {
      prefix.push({
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
      });
    }
    if (rowActions?.onEdit || rowActions?.onDelete || rowActions?.sperren) {
      // B1.1: bei polishActionVisibility='hover' sind die Icons nur per
      // Maus-Hover oder Tastatur-Fokus auf der Zeile sichtbar — auf Mobile
      // (< md) bleiben sie sichtbar, damit Touch-User sie weiterhin
      // erreichen (Long-Press-Menü kommt in B5/später).
      const actionWrapperClass =
        polishActionVisibility === 'hover'
          ? 'flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
          : 'flex items-center gap-0.5';
      prefix.push({
        id: '__actions__',
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        enableGrouping: false,
        header: '',
        cell: ({ row }) => {
          const isGesperrt = rowActions.sperren?.isGesperrt(row.original) ?? false;
          return (
            <div className={actionWrapperClass}>
              {rowActions.onEdit && (
                <button
                  type="button"
                  onClick={() => rowActions.onEdit?.(row.original)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Bearbeiten"
                  aria-label="Bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {rowActions.sperren && (
                <button
                  type="button"
                  onClick={() => rowActions.sperren?.onToggle(row.original)}
                  className={
                    isGesperrt
                      ? 'rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10'
                      : 'rounded-md p-1.5 text-zinc-400 hover:bg-amber-500/10 hover:text-amber-400'
                  }
                  title={isGesperrt ? 'Aktivieren' : 'Deaktivieren'}
                  aria-label={isGesperrt ? 'Aktivieren' : 'Deaktivieren'}
                >
                  {isGesperrt ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {rowActions.onDelete && (
                <button
                  type="button"
                  onClick={() => rowActions.onDelete?.([row.original])}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  title="Löschen"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        },
      });
    }
    return [...prefix, ...columns];
  }, [columns, enableRowSelection, rowActions, polishActionVisibility]);

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
  useEffect(() => {
    if (!showSettingsMenu) return;
    function handler(e: MouseEvent) {
      if (!settingsMenuRef.current?.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettingsMenu]);

  // Stabile Default-Konstanten — sonst erzeugt jedes Render einer dieser
  // Inline-Werte (z. B. `rowSelection ?? {}`) ein neues Object, was
  // useReactTable als state-change interpretiert → endlose Re-Renders.
  const stableEmptyRowSelection = useMemo<RowSelectionState>(() => ({}), []);
  const stableEmptyColumnFilters = useMemo<ColumnFiltersState>(() => [], []);

  // WICHTIG: Grouping nur aktivieren, wenn der Aufrufer auch
  // `onGroupingChange` mitgibt. TanStack-Table v8.21 hat einen Bug, bei
  // dem `state.grouping = []` + `getGroupedRowModel` einen internen
  // setState-Loop in der `expanded`-State-Verwaltung triggert → 2000+
  // Re-Renders pro Mount und Total-Block des Mainthreads.
  const groupingEnabled = onGroupingChange !== undefined;

  // __select__ + __actions__ sind hartcodiert ganz links: wenn die Page einen
  // columnOrder gibt, der diese Spezial-Spalten nicht enthält (üblich, weil
  // Pages die nicht selbst kennen), prepend wir sie hier. So bleibt das
  // [Select] [Edit/Delete] Layout immer als erstes sichtbar — beide sind auch
  // nicht per Drag-Reorder verschiebbar (siehe onDrop unten).
  const hasActions = !!(
    rowActions?.onEdit ||
    rowActions?.onDelete ||
    rowActions?.sperren
  );
  const effectiveColumnOrder = useMemo(() => {
    if (columnOrder.length === 0) return undefined;
    const order = [...columnOrder];
    if (hasActions && !order.includes('__actions__')) {
      order.unshift('__actions__');
    }
    if (enableRowSelection && !order.includes('__select__')) {
      order.unshift('__select__');
    }
    return order;
  }, [columnOrder, enableRowSelection, hasActions]);

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    defaultColumn: stableDefaultColumn,
    state: {
      sorting,
      columnVisibility: visibility,
      columnFilters: columnFilters ?? stableEmptyColumnFilters,
      columnOrder: effectiveColumnOrder,
      rowSelection: rowSelection ?? stableEmptyRowSelection,
      ...(groupingEnabled && grouping ? { grouping } : {}),
    },
    enableMultiSort: true,
    enableSortingRemoval: true,
    isMultiSortEvent: (e) => (e as React.MouseEvent).shiftKey,
    enableRowSelection,
    enableGrouping: groupingEnabled,
    autoResetExpanded: false,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: stableCoreRowModel,
    getSortedRowModel: stableSortedRowModel,
    getFilteredRowModel: stableFilteredRowModel,
    getExpandedRowModel: stableExpandedRowModel,
    // Faceted-Row-Model: liefert pro Spalte distinct-Werte (für ComboboxFilter-
    // Dropdown). Casts erforderlich, weil TanStack die Factory streng generisch
    // an TData bindet; die Implementierung ist intern aber data-agnostic, wir
    // halten die Factory daher als Modul-Konstante.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    getFacetedRowModel: stableFacetedRowModel as any,
    getFacetedUniqueValues: stableFacetedUniqueValues as any,
    /* eslint-enable @typescript-eslint/no-explicit-any */
    ...(groupingEnabled
      ? { getGroupedRowModel: stableGroupedRowModel }
      : {}),
    onSortingChange: (updater) =>
      onSortingChange(
        typeof updater === 'function' ? updater(sorting) : updater,
      ),
    onColumnVisibilityChange: (updater) =>
      onVisibilityChange(
        typeof updater === 'function' ? updater(visibility) : updater,
      ),
    onColumnFiltersChange: (updater) =>
      onColumnFiltersChange(
        typeof updater === 'function'
          ? updater(columnFilters ?? stableEmptyColumnFilters)
          : updater,
      ),
    onColumnOrderChange: (updater) =>
      onColumnOrderChange(
        typeof updater === 'function' ? updater(columnOrder) : updater,
      ),
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) return;
      onRowSelectionChange(
        typeof updater === 'function'
          ? updater(rowSelection ?? stableEmptyRowSelection)
          : updater,
      );
    },
    ...(groupingEnabled && onGroupingChange
      ? {
          onGroupingChange: (updater: unknown) => {
            onGroupingChange(
              typeof updater === 'function'
                ? (updater as (g: GroupingState) => GroupingState)(
                    grouping ?? [],
                  )
                : (updater as GroupingState),
            );
          },
        }
      : {}),
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((r) => r.original)
    : [];

  // Drag & Drop: Reorder via HTML5 D&D auf den th-Headers,
  // zusätzlich Group-Drag in die Drop-Zone oberhalb der Toolbar.
  // Das Drop-Target entscheidet die Aktion: text/plain → Reorder,
  // text/group-col → Group.
  function onDragStart(colId: string, e: React.DragEvent<HTMLDivElement>) {
    setDraggingCol(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
    e.dataTransfer.setData(GROUP_DRAG_MIME, colId);
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
    // __select__ und __actions__ bleiben immer vorne (Tim R6b-Konvention)
    if (sourceColId === '__select__' || targetColId === '__select__') return;
    if (sourceColId === '__actions__' || targetColId === '__actions__') return;

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

  // Drop-Zone für Gruppierung: nur aktiv wenn Aufrufer Grouping unterstützt.
  // Backwards-Compat: Wenn `groupableColumns` gegeben ist, gilt diese
  // Whitelist (Verhalten wie bisher). Sonst sind alle Spalten außer
  // __select__ gruppierbar (Tims neue Anforderung „alle Listen frei
  // gruppierbar").
  function isColumnGroupable(colId: string): boolean {
    if (colId === '__select__' || colId === '__actions__') return false;
    if (groupableColumns && groupableColumns.length > 0) {
      return groupableColumns.some((g) => g.id === colId);
    }
    return true;
  }

  function labelForGroupColumn(colId: string): string {
    if (groupableColumns) {
      const found = groupableColumns.find((g) => g.id === colId);
      if (found) return found.label;
    }
    // Fallback: Header-Text aus der ColumnDef ziehen.
    const col = table.getAllLeafColumns().find((c) => c.id === colId);
    if (col && typeof col.columnDef.header === 'string') {
      return col.columnDef.header;
    }
    return colId;
  }

  function onDropZoneDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Nur reagieren, wenn auch wirklich ein Group-Drag im Gange ist.
    // (text/group-col kann nicht in DragEnter zuverlässig gelesen werden,
    // aber `types` enthält den Eintrag schon zum Drag-Start.)
    if (!e.dataTransfer.types.includes(GROUP_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dropZoneHover) setDropZoneHover(true);
  }

  function onDropZoneDragLeave() {
    setDropZoneHover(false);
  }

  function onDropZoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropZoneHover(false);
    setDraggingCol(null);
    if (!onGroupingChange) return;
    const colId = e.dataTransfer.getData(GROUP_DRAG_MIME);
    if (!colId) return;
    if (!isColumnGroupable(colId)) return;
    // Doppelte Gruppierung verhindern: wenn Column schon in `grouping`,
    // einfach ignorieren — kein Re-Add an anderer Stelle.
    if (grouping.includes(colId)) return;
    onGroupingChange([...grouping, colId]);
  }

  function removeGrouping(colId: string) {
    if (!onGroupingChange) return;
    onGroupingChange(grouping.filter((g) => g !== colId));
  }

  // Toggle-Logik für Sortierung einer Gruppen-Spalte:
  //   keine → asc → desc → keine
  // Multi-Sort wird nicht angefasst — die Gruppen-Spalte ist eigener Eintrag
  // im sorting-State.
  function toggleGroupSort(colId: string) {
    const current = sorting.find((s) => s.id === colId);
    let next: SortingState;
    if (!current) {
      next = [...sorting, { id: colId, desc: false }];
    } else if (current.desc === false) {
      next = sorting.map((s) =>
        s.id === colId ? { id: colId, desc: true } : s,
      );
    } else {
      next = sorting.filter((s) => s.id !== colId);
    }
    onSortingChange(next);
  }

  // Drop-Zone wird als Sektion innerhalb des Block-Containers gerendert
  // (direkt vor der Tabelle). Border-Bottom trennt sie visuell vom Header.
  const dropZone = onGroupingChange ? (
    <div
      onDragOver={onDropZoneDragOver}
      onDragEnter={onDropZoneDragOver}
      onDragLeave={onDropZoneDragLeave}
      onDrop={onDropZoneDrop}
      className={`flex min-h-[36px] flex-wrap items-center gap-2 border-b px-3 py-1.5 transition-colors ${
        dropZoneHover
          ? 'border-emerald-400/70 bg-emerald-500/10'
          : grouping.length > 0
            ? 'border-zinc-800 bg-zinc-900/40'
            : 'border-zinc-800 bg-zinc-950/30'
      }`}
      data-testid="power-listen-drop-zone"
    >
      <Pin
        className={`h-3.5 w-3.5 shrink-0 ${
          dropZoneHover
            ? 'text-emerald-300'
            : grouping.length > 0
              ? 'text-emerald-400/80'
              : 'text-zinc-500'
        }`}
        aria-hidden
      />
      {grouping.length === 0 ? (
        <span className="text-xs text-zinc-500">
          Spalten hier ablegen zum Gruppieren …
        </span>
      ) : (
        <>
          {grouping.map((colId, idx) => {
            const label = labelForGroupColumn(colId);
            const sortEntry = sorting.find((s) => s.id === colId);
            const SortIcon =
              sortEntry === undefined
                ? ArrowUpDown
                : sortEntry.desc
                  ? ArrowDown
                  : ArrowUp;
            return (
              <span
                key={colId}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-0.5 pl-2 pr-1 text-xs text-emerald-200"
              >
                <span className="font-mono text-[10px] text-emerald-400/70">
                  {idx + 1}.
                </span>
                <span className="font-medium">{label}</span>
                <button
                  type="button"
                  onClick={() => toggleGroupSort(colId)}
                  className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20"
                  title="Gruppen-Sortierung umschalten (asc → desc → keine)"
                  aria-label={`Sortierung für ${label} umschalten`}
                >
                  <SortIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeGrouping(colId)}
                  className="rounded p-0.5 text-emerald-300 hover:bg-red-500/20 hover:text-red-300"
                  title="Gruppierung entfernen"
                  aria-label={`Gruppierung nach ${label} entfernen`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <span className="text-xs text-zinc-500">
            weitere Spalten hier ablegen …
          </span>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
        <div className="flex items-center gap-2">{toolbarLeft}</div>
        <div className="relative min-w-[18rem] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder={
              polishSearchShortcut
                ? `${searchPlaceholder}  (/)`
                : searchPlaceholder
            }
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>
        {filterButton}
        {!polishConsolidatedMenu && (
        <div className="relative" ref={columnPickerRef}>
          <button
            type="button"
            onClick={() => setShowColumnPicker((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Spalten ({visibleLeafColumns.filter((c) => c.id !== '__select__' && c.id !== '__actions__').length})
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
              {table
                .getAllLeafColumns()
                .filter((col) => col.id !== '__select__' && col.id !== '__actions__')
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
        )}
        {!polishConsolidatedMenu && onGroupingChange && groupableColumns && groupableColumns.length > 0 && (
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
        {/* B3.3 Zahnrad-Menü: ersetzt Spalten- + Group-Picker (oben hinter
            !polishConsolidatedMenu versteckt). Drei Tabs: Spalten | Gruppen
            | Ansicht (Density). Der Gruppen-Tab erscheint nur, wenn die
            Page Grouping aktiv hat, der Ansicht-Tab nur bei densityToggle. */}
        {polishConsolidatedMenu && (
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setShowSettingsMenu((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                grouping.length > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Ansicht anpassen — Spalten · Gruppen · Density"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Ansicht
              {grouping.length > 0 && (
                <span className="rounded bg-emerald-500/30 px-1 font-mono text-[10px]">
                  {grouping.length}
                </span>
              )}
            </button>
            {showSettingsMenu && (
              <div className="absolute right-0 z-30 mt-1 w-72 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="flex border-b border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setSettingsTab('spalten')}
                    className={`flex-1 px-3 py-2 ${
                      settingsTab === 'spalten'
                        ? 'border-b-2 border-emerald-500 text-emerald-300'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Spalten
                  </button>
                  {onGroupingChange &&
                    groupableColumns &&
                    groupableColumns.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab('gruppen')}
                        className={`flex-1 px-3 py-2 ${
                          settingsTab === 'gruppen'
                            ? 'border-b-2 border-emerald-500 text-emerald-300'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Gruppen
                        {grouping.length > 0 && (
                          <span className="ml-1 font-mono text-[10px] text-emerald-400/80">
                            {grouping.length}
                          </span>
                        )}
                      </button>
                    )}
                  {polishDensityToggle && (
                    <button
                      type="button"
                      onClick={() => setSettingsTab('ansicht')}
                      className={`flex-1 px-3 py-2 ${
                        settingsTab === 'ansicht'
                          ? 'border-b-2 border-emerald-500 text-emerald-300'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Ansicht
                    </button>
                  )}
                </div>
                {settingsTab === 'spalten' && (
                  <div className="max-h-72 overflow-y-auto p-2">
                    {table
                      .getAllLeafColumns()
                      .filter(
                        (col) =>
                          col.id !== '__select__' && col.id !== '__actions__',
                      )
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
                {settingsTab === 'gruppen' &&
                  onGroupingChange &&
                  groupableColumns && (
                    <div className="max-h-72 overflow-y-auto p-1">
                      <button
                        type="button"
                        onClick={() => onGroupingChange([])}
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
                {settingsTab === 'ansicht' && polishDensityToggle && (
                  <div className="p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      <Rows3 className="h-3 w-3" />
                      Zeilen-H&ouml;he
                    </div>
                    <div className="flex gap-1">
                      {DENSITY_VALUES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDensity(d)}
                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                            density === d
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {DENSITY_LABELS[d]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Pers&ouml;nliche Einstellung — wird f&uuml;r diese
                      Liste gespeichert.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Sort + Spalten-Filter werden direkt an der jeweiligen Spalte
            zurückgesetzt (Klick auf den Sortier-Indikator bzw. „X" am
            Filter). Tim R6b-Konvention: keine hartcodierten Reset-Buttons
            in der Toolbar. */}
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
        <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
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

      {dropZone}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;
                  const canSort = header.column.getCanSort();
                  const sortIdx = sorting.findIndex((s) => s.id === colId);
                  const sortDir = header.column.getIsSorted();
                  // Drag-Reorder ist nur für sortable/reorderable Spalten aktiv.
                  // Der frühere Mainthread-Freeze kam NICHT vom HTML5-draggable,
                  // sondern vom TanStack-Table-Grouping-Loop (jetzt gefixt).
                  const isDraggable = colId !== '__select__' && colId !== '__actions__';
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
                              column: header.column,
                            })}
                          </div>
                        );
                      })()}
                    </th>
                  );
                })}
              </tr>
            ))}
            {/* Inline-Mass-Edit-Zeile — sichtbar wenn ≥1 Row markiert,
                onMassEdit-Callback vorhanden und mindestens eine Spalte
                `meta.massEdit` definiert. Pro Spalte mit `meta.massEdit`
                wird ein passendes Eingabe-Element gerendert. */}
            {enableRowSelection &&
              selectedRows.length > 0 &&
              onMassEdit &&
              table.getAllLeafColumns().some((c) => {
                const m = (c.columnDef.meta ?? {}) as { massEdit?: MassEditSpec };
                return m.massEdit !== undefined;
              }) && (
              <tr className="border-t border-emerald-500/20 bg-emerald-500/5">
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const colId = header.column.id;
                  if (colId === '__select__') {
                    return (
                      <th
                        key={`mass-${colId}`}
                        className="px-3 py-2 align-middle text-[10px] font-medium uppercase tracking-wide text-emerald-300"
                      >
                        bearbeiten
                      </th>
                    );
                  }
                  const meta = (header.column.columnDef.meta ?? {}) as {
                    massEdit?: MassEditSpec;
                  };
                  const spec = meta.massEdit;
                  if (!spec) {
                    return <th key={`mass-${colId}`} className="px-3 py-2" />;
                  }
                  const busy = massEditBusy === colId;
                  // Klick auf Anwenden → erst Confirm-Dialog zeigen.
                  // Bei Confirm bleibt die eigentliche Mutation in `runMassEdit`.
                  const handleApply = (value: unknown) => {
                    if (busy) return;
                    const columnLabel =
                      typeof header.column.columnDef.header === 'string'
                        ? header.column.columnDef.header
                        : colId;
                    // Lese-freundliches Label für den Wert (z. B. „aktiv" statt UUID).
                    let valueLabel: string;
                    if (value === null) {
                      valueLabel = 'leer';
                    } else if (typeof value === 'boolean') {
                      valueLabel = value ? 'Ja' : 'Nein';
                    } else if (spec.options) {
                      valueLabel =
                        spec.options.find((o) => o.value === value)?.label ??
                        String(value);
                    } else {
                      valueLabel = String(value);
                    }
                    setMassEditConfirm({
                      colId,
                      value,
                      columnLabel,
                      valueLabel,
                      count: selectedRows.length,
                    });
                  };
                  return (
                    <th
                      key={`mass-${colId}`}
                      className="px-2 py-1 align-top font-normal normal-case"
                    >
                      <MassEditCell
                        spec={spec}
                        busy={busy}
                        onApply={handleApply}
                      />
                    </th>
                  );
                })}
              </tr>
            )}
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
                    sticky={polishStickyGroupHeaders}
                    separators={polishGroupSeparators}
                    tdClass={groupTdClass}
                  />
                );
              }
              // B1.4: Kinder einer Gruppe (row.depth > 0) bekommen eine dezente
              // Schattierung, damit Gruppen optisch als Block lesbar werden.
              const isGroupedChild = polishGroupSeparators && row.depth > 0;
              return (
                <tr
                  key={row.id}
                  className={`group border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-800/40 ${
                    row.getIsSelected()
                      ? 'bg-emerald-500/5'
                      : isGroupedChild
                        ? 'bg-zinc-900/30'
                        : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`${bodyTdClass} align-top`}>
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
      {massEditStatus && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-md border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm text-emerald-200 shadow-2xl">
          {massEditStatus}
        </div>
      )}
      {/* Sicherheits-Abfrage vor Mass-Edit (Tim R5: vor jedem Bulk-Update). */}
      <ConfirmDialog
        open={massEditConfirm !== null}
        title="Massen-Änderung bestätigen"
        tone="primary"
        confirmLabel="Übernehmen"
        cancelLabel="Abbrechen"
        busy={massEditBusy !== null}
        message={
          massEditConfirm ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p>
                Spalte <strong>{massEditConfirm.columnLabel}</strong> für{' '}
                <strong>{massEditConfirm.count}</strong> Datensätze auf{' '}
                <strong className="text-emerald-300">
                  „{massEditConfirm.valueLabel}&ldquo;
                </strong>{' '}
                setzen?
              </p>
              <p className="text-xs text-zinc-500">
                Diese Änderung wirkt auf alle ausgewählten Zeilen gleichzeitig.
              </p>
            </div>
          ) : (
            ''
          )
        }
        onConfirm={async () => {
          if (!massEditConfirm) return;
          const { colId, value } = massEditConfirm;
          setMassEditBusy(colId);
          setMassEditStatus(null);
          try {
            const res = await onMassEdit?.(colId, value, selectedRows);
            if (res) {
              setMassEditStatus(
                `${res.ok}/${res.ok + res.failed} aktualisiert`,
              );
            } else {
              setMassEditStatus(`${selectedRows.length} aktualisiert`);
            }
          } catch (e) {
            setMassEditStatus(
              `Fehler: ${(e as Error).message ?? 'unbekannt'}`,
            );
          } finally {
            setMassEditBusy(null);
            setMassEditConfirm(null);
            setTimeout(() => setMassEditStatus(null), 3500);
          }
        }}
        onCancel={() => setMassEditConfirm(null)}
      />
    </div>
  );
}

/** Inline-Cell für Mass-Edit pro Spalte.
 *  Type 'text' rendert ein Input mit Enter-zum-Anwenden + Apply-Button.
 *  Type 'auswahl' rendert ein Select; Selection triggert sofort apply.
 *  Type 'boolean' rendert zwei Buttons (Ja/Nein).
 */
function MassEditCell({
  spec,
  busy,
  onApply,
}: {
  spec: MassEditSpec;
  busy: boolean;
  onApply: (value: unknown) => void;
}) {
  const [textValue, setTextValue] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Click-outside zum Schließen der Combobox
  useEffect(() => {
    if (!comboboxOpen) return;
    function handler(e: MouseEvent) {
      if (!comboboxRef.current?.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [comboboxOpen]);

  if (spec.type === 'auswahl') {
    return (
      <select
        disabled={busy}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value === '') return;
          onApply(e.target.value);
          e.target.value = '';
        }}
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none disabled:opacity-60"
      >
        <option value="">{busy ? 'wende an …' : 'setzen auf …'}</option>
        {spec.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === 'combobox') {
    const filtered = (spec.options ?? []).filter(
      (o) =>
        comboboxSearch === '' ||
        o.label.toLowerCase().includes(comboboxSearch.toLowerCase()),
    );
    return (
      <div ref={comboboxRef} className="relative w-full">
        <button
          type="button"
          disabled={busy}
          onClick={() => setComboboxOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-1 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-60"
        >
          <span className="truncate">{busy ? 'wende an …' : 'setzen auf …'}</span>
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform ${comboboxOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {comboboxOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 w-max min-w-full max-w-sm overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="border-b border-zinc-800 p-1">
              <input
                type="text"
                value={comboboxSearch}
                autoFocus
                onChange={(e) => setComboboxSearch(e.target.value)}
                placeholder="filtern …"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-1 text-[11px] text-zinc-500">
                  Keine Treffer
                </div>
              ) : (
                filtered.slice(0, 100).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onApply(o.value);
                      setComboboxOpen(false);
                      setComboboxSearch('');
                    }}
                    className="block w-full truncate px-2 py-1 text-left text-xs text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (spec.type === 'null') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onApply(null)}
        className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
        title="Wert für alle Auswahl auf NULL setzen"
      >
        {busy ? '…' : 'leeren'}
      </button>
    );
  }
  if (spec.type === 'boolean') {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(true)}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Ja
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(false)}
          className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Nein
        </button>
      </div>
    );
  }
  // 'text' (default)
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={textValue}
        disabled={busy}
        placeholder={busy ? '…' : 'neuer Wert'}
        onChange={(e) => setTextValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && textValue !== '') {
            onApply(textValue);
            setTextValue('');
          }
        }}
        className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        disabled={busy || textValue === ''}
        onClick={() => {
          if (textValue === '') return;
          onApply(textValue);
          setTextValue('');
        }}
        className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
        title="Anwenden (oder Enter)"
      >
        ↵
      </button>
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
  sticky = false,
  separators = false,
  tdClass = 'px-3 py-2',
}: {
  row: Row<TData>;
  colSpan: number;
  groupableColumns?: { id: string; label: string }[];
  sticky?: boolean;
  separators?: boolean;
  tdClass?: string;
}) {
  const value = row.groupingValue;
  const colId = row.groupingColumnId;
  const colLabel =
    groupableColumns?.find((g) => g.id === colId)?.label ?? colId;
  const valueText =
    value === '' || value === null || value === undefined
      ? '— (leer)'
      : String(value);
  // B1.3 sticky: <tr> selbst ist nicht sticky-fähig in vielen Browsern, daher
  // wird die <td> sticky gesetzt. Hintergrund opak halten, damit darunter
  // liegende Body-Rows nicht durchscheinen.
  // B1.4 separators: dickerer Top-Border + mehr Saturation, damit der
  // Gruppen-Wechsel klar erkennbar ist.
  const trClass = separators
    ? 'border-t-2 border-emerald-500/30 bg-zinc-900'
    : 'border-y border-zinc-800 bg-zinc-900/70';
  const tdStickyClass = sticky
    ? 'sticky top-0 z-10 bg-zinc-900 shadow-[0_1px_0_0_rgb(39_39_42)]'
    : '';
  return (
    <tr className={trClass}>
      <td colSpan={colSpan} className={`${tdClass} ${tdStickyClass}`}>
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
