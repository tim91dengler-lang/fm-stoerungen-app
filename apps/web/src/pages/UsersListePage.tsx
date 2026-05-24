import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { userApi } from '../api/endpoints';
import type { UserRead } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../lib/format';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  grouping: GroupingState;
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'full_name', desc: false }],
  visibility: {},
  columnOrder: ['full_name', 'email', 'roles', 'is_active', 'created_at'],
  columnFilters: [],
  grouping: [],
};

export function UsersListePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirm, setBulkConfirm] = useState<UserRead[] | null>(null);
  const qc = useQueryClient();

  const isAdmin = user?.roles.includes('admin') ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search],
    queryFn: () =>
      userApi.list({ search: search.trim() || undefined, limit: 100 }),
    enabled: isAdmin,
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      // soft-delete via DELETE /users/{id}; backend rejects self-deletion 403
      await Promise.all(ids.map((id) => userApi.remove(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setRowSelection({});
      setBulkConfirm(null);
    },
  });

  const columns = useMemo<ColumnDef<UserRead>[]>(
    () => [
      {
        id: 'full_name',
        accessorKey: 'full_name',
        header: 'Name',
        filterFn: 'includesString',
        cell: (ctx) => (
          <span className="font-medium text-zinc-100">{ctx.row.original.full_name}</span>
        ),
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'E-Mail',
        filterFn: 'includesString',
        cell: (ctx) => <span className="text-zinc-300">{ctx.row.original.email}</span>,
      },
      {
        id: 'roles',
        accessorFn: (row) => row.roles.map((r) => r.name).join(', '),
        header: 'Rollen',
        filterFn: 'includesString',
        cell: (ctx) => (
          <span className="text-zinc-300">
            {ctx.row.original.roles.map((r) => r.name).join(', ') || '—'}
          </span>
        ),
      },
      {
        id: 'is_active',
        accessorFn: (row) => (row.is_active ? 'aktiv' : 'inaktiv'),
        header: 'Status',
        filterFn: 'arrIncludesSome',
        cell: (ctx) =>
          ctx.row.original.is_active ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              aktiv
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              inaktiv
            </span>
          ),
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Angelegt',
        cell: (ctx) => (
          <span className="text-zinc-400">{formatDateTime(ctx.row.original.created_at)}</span>
        ),
      },
    ],
    [],
  );

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Diese Ansicht ist nur für Admins. Wende dich an einen Admin, wenn du
          User-Zugriff brauchst.
        </div>
      </div>
    );
  }

  // Filter out the current user from any bulk-delete payload — backend
  // rejects self-deletion anyway, but we shouldn't even surface it to the user.
  const selfExcluded = (rows: UserRead[]): UserRead[] =>
    rows.filter((r) => r.id !== user?.id);

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Benutzer</h1>
        <p className="text-sm text-zinc-500">
          {data ? `${data.total} Treffer` : '—'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Fehler beim Laden.
        </div>
      )}

      {!isLoading && (
        <PowerListenView<UserRead>
          viewKey="users"
          columns={columns}
          data={data?.items ?? []}
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
            full_name: TextFilter,
            email: TextFilter,
            roles: TextFilter,
            is_active: (props) => (
              <SelectFilter
                {...props}
                options={[
                  { value: 'aktiv', label: 'aktiv' },
                  { value: 'inaktiv', label: 'inaktiv' },
                ]}
              />
            ),
          }}
          enableRowSelection={isAdmin}
          getRowId={(u) => u.id}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          bulkActions={(selected) => {
            const deletable = selfExcluded(selected);
            return (
              <button
                type="button"
                onClick={() => setBulkConfirm(selected)}
                disabled={bulkDeleteMut.isPending || deletable.length === 0}
                className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                title={
                  deletable.length === 0
                    ? 'Du kannst dich nicht selbst löschen'
                    : undefined
                }
              >
                Löschen ({deletable.length})
              </button>
            );
          }}
          count={{
            filtered: data?.items.length ?? 0,
            total: data?.total ?? 0,
          }}
          toolbarLeft={
            <SavedViewsMenu
              viewKey="users"
              currentConfig={config as unknown as Record<string, unknown>}
              onApply={(c) => {
                setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<ViewConfig>) });
                setActiveViewId(null);
              }}
              activeId={activeViewId}
            />
          }
          searchPlaceholder="Suche in Name + E-Mail …"
          showFooter
          itemLabel={{ singular: 'Benutzer', plural: 'Benutzer' }}
        />
      )}

      <ConfirmDialog
        open={bulkConfirm !== null}
        title={
          bulkConfirm && selfExcluded(bulkConfirm).length === 1
            ? 'Benutzer löschen?'
            : `${bulkConfirm ? selfExcluded(bulkConfirm).length : 0} Benutzer löschen?`
        }
        message={
          <span>
            {bulkConfirm && bulkConfirm.length > selfExcluded(bulkConfirm).length && (
              <span className="mb-2 block text-xs text-amber-400">
                Dein eigener Account wurde aus der Auswahl entfernt — du kannst
                dich nicht selbst löschen.
              </span>
            )}
            {bulkConfirm && selfExcluded(bulkConfirm).length === 1 ? (
              <>
                Benutzer <strong>{selfExcluded(bulkConfirm)[0]?.full_name}</strong>{' '}
                wirklich löschen (Soft-Delete)? Der Account wird deaktiviert.
              </>
            ) : (
              <>
                {bulkConfirm ? selfExcluded(bulkConfirm).length : 0} ausgewählte
                Benutzer werden per Soft-Delete deaktiviert.
              </>
            )}
          </span>
        }
        busy={bulkDeleteMut.isPending}
        onConfirm={() => {
          if (!bulkConfirm) return;
          const ids = selfExcluded(bulkConfirm).map((u) => u.id);
          if (ids.length === 0) {
            setBulkConfirm(null);
            return;
          }
          bulkDeleteMut.mutate(ids);
        }}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}
