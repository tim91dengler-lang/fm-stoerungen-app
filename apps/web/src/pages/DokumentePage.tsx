import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Download,
  FileBox,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import { dokumentApi } from '../api/endpoints';
import type { DokumentRead, DokumentUpdate } from '../api/types';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import {
  MassEditModal,
  type ColumnSpec,
  type MassEditResult,
} from '../core/liste/MassEditModal';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'name', desc: false }],
  visibility: {},
  columnOrder: ['name', 'kategorie', 'size', 'hochgeladen', 'links', '__actions__'],
  columnFilters: [],
  grouping: [],
};

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileBox;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function DokumentePage() {
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<DokumentRead[] | null>(null);
  const [massEditRows, setMassEditRows] = useState<DokumentRead[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Dokumente.kategorie is a free-text string (no auswahlliste exists yet).
  // Beschreibung also free text.
  const massEditColumns: ColumnSpec[] = [
    { id: 'kategorie', label: 'Kategorie', type: 'text' },
    { id: 'beschreibung', label: 'Beschreibung', type: 'text' },
  ];

  async function handleMassEdit(
    rows: DokumentRead[],
    columnId: string,
    value: unknown,
  ): Promise<MassEditResult> {
    const payload: DokumentUpdate = { [columnId]: value } as DokumentUpdate;
    const results = await Promise.allSettled(
      rows.map((r) => dokumentApi.update(r.id, payload)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: ['dokumente'] });
    setRowSelection({});
    return { ok, failed: results.length - ok };
  }

  const listQuery = useQuery({
    queryKey: ['dokumente'],
    queryFn: () => dokumentApi.list(),
  });

  const filtered = useMemo(() => {
    const items = listQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.filename.toLowerCase().includes(q) ||
        (d.kategorie ?? '').toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(files.map((f) => dokumentApi.upload(f))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dokumente'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dokumentApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dokumente'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => dokumentApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dokumente'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) upload.mutate(files);
  }

  async function download(d: DokumentRead) {
    const blob = await api
      .get<Blob>(`/dokumente/${d.id}/file`, { responseType: 'blob' })
      .then((r) => r.data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = d.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<DokumentRead>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        filterFn: 'includesString',
        cell: (ctx) => {
          const d = ctx.row.original;
          const Icon = fileIcon(d.mime_type);
          return (
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-zinc-500" />
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-200">{d.name}</div>
                <div className="truncate text-xs text-zinc-500">{d.filename}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'kategorie',
        accessorKey: 'kategorie',
        header: 'Kategorie',
        filterFn: 'includesString',
        cell: (ctx) => {
          const k = ctx.row.original.kategorie;
          if (!k) return <span className="text-zinc-500">—</span>;
          return (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {k}
            </span>
          );
        },
      },
      {
        id: 'size',
        accessorKey: 'size_bytes',
        header: 'Größe',
        cell: (ctx) => (
          <span className="text-xs text-zinc-500">{formatBytes(ctx.row.original.size_bytes)}</span>
        ),
      },
      {
        id: 'hochgeladen',
        accessorFn: (row) => row.hochgeladen_von?.full_name ?? '',
        header: 'Hochgeladen',
        filterFn: 'includesString',
        cell: (ctx) => {
          const d = ctx.row.original;
          return (
            <div className="text-xs text-zinc-500">
              {d.hochgeladen_von?.full_name ?? '—'}
              <div className="text-[10px]">
                {new Date(d.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>
          );
        },
      },
      {
        id: 'links',
        accessorFn: (row) => row.links.map((l) => l.target_type).join(' '),
        header: 'Verknüpfungen',
        cell: (ctx) => {
          const links = ctx.row.original.links;
          if (links.length === 0) return <span className="text-zinc-500">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {links.map((l) => (
                <span
                  key={`${l.target_type}-${l.target_id}`}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400"
                >
                  {l.target_type}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: '__actions__',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        enableGrouping: false,
        cell: (ctx) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => download(ctx.row.original)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Herunterladen"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm([ctx.row.original])}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
              title="Löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  function confirmBulkDelete() {
    if (!bulkConfirm) return;
    if (bulkConfirm.length === 1 && bulkConfirm[0] !== undefined) {
      remove.mutate(bulkConfirm[0].id, {
        onSuccess: () => setBulkConfirm(null),
      });
    } else {
      bulkDeleteMut.mutate(bulkConfirm.map((d) => d.id));
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <FileBox className="h-5 w-5 text-emerald-400" /> Dokumente
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Wartungsverträge, Pläne, Datenblätter — mit Verknüpfungen zu Ticket / Projekt / Objekt
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Hochladen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) upload.mutate(files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={clsx(
          'rounded-lg border-2 border-dashed bg-zinc-900/40 p-6 text-center transition-colors',
          dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800',
        )}
      >
        <UploadCloud
          className={clsx(
            'mx-auto mb-2 h-8 w-8',
            dragOver ? 'text-emerald-400' : 'text-zinc-600',
          )}
        />
        <p className="text-sm text-zinc-400">
          {upload.isPending ? 'Lade hoch …' : 'Dateien hier ablegen oder oben rechts hochladen'}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          PDF, Bilder, Office-Dokumente (max 30 MB)
        </p>
      </div>

      <PowerListenView<DokumentRead>
        viewKey="dokumente"
        columns={columns}
        data={filtered}
        search={search}
        onSearchChange={setSearch}
        visibility={config.visibility}
        onVisibilityChange={(v) => setConfig((p) => ({ ...p, visibility: v }))}
        sorting={config.sorting}
        onSortingChange={(s) => setConfig((p) => ({ ...p, sorting: s }))}
        columnFilters={config.columnFilters}
        onColumnFiltersChange={(f) =>
          setConfig((p) => ({ ...p, columnFilters: f }))
        }
        columnOrder={config.columnOrder}
        onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
        grouping={config.grouping}
        onGroupingChange={(g) => setConfig((p) => ({ ...p, grouping: g }))}
        filterRenderers={{
          name: TextFilter,
          kategorie: TextFilter,
          hochgeladen: TextFilter,
        }}
        enableRowSelection
        getRowId={(d) => d.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        bulkActions={(selected) => (
          <>
            <button
              type="button"
              onClick={() => setMassEditRows(selected)}
              className="rounded-md border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              Bearbeiten ({selected.length})
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm(selected)}
              disabled={bulkDeleteMut.isPending}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Löschen ({selected.length})
            </button>
          </>
        )}
        count={{
          filtered: filtered.length,
          total: listQuery.data?.length ?? 0,
        }}
        toolbarLeft={
          <SavedViewsMenu
            viewKey="dokumente"
            currentConfig={config as unknown as Record<string, unknown>}
            onApply={(c) => {
              setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
              setActiveViewId(null);
            }}
            activeId={activeViewId}
          />
        }
        searchPlaceholder="Suche in Dokumenten …"
        showFooter
        itemLabel={{ singular: 'Dokument', plural: 'Dokumente' }}
      />

      <MassEditModal<DokumentRead>
        open={massEditRows !== null}
        selectedRows={massEditRows ?? []}
        columns={massEditColumns}
        itemLabel={{ singular: 'Dokument', plural: 'Dokumente' }}
        onClose={() => setMassEditRows(null)}
        onSubmit={(col, val) =>
          handleMassEdit(massEditRows ?? [], col, val)
        }
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && bulkConfirm.length === 1
            ? 'Dokument löschen?'
            : `${bulkConfirm?.length ?? 0} Dokumente löschen?`
        }
        message={
          bulkConfirm && bulkConfirm.length === 1 ? (
            <span>
              Dokument <strong>{bulkConfirm[0]?.name}</strong> wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </span>
          ) : (
            <span>
              {bulkConfirm?.length ?? 0} ausgewählte Dokumente werden
              unwiderruflich gelöscht.
            </span>
          )
        }
        busy={remove.isPending || bulkDeleteMut.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}
