import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef, type SortingState, type VisibilityState } from '@tanstack/react-table';
import { userApi } from '../api/endpoints';
import type { UserRead } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../lib/format';
import { PowerListenView } from '../core/liste/PowerListenView';
import { SavedViewsMenu } from '../core/liste/SavedViewsMenu';
import { SelectFilter, TextFilter } from '../core/liste/columnFilters';

interface ViewConfig {
  sorting: SortingState;
  visibility: VisibilityState;
  columnOrder: string[];
}

const DEFAULT_CONFIG: ViewConfig = {
  sorting: [{ id: 'full_name', desc: false }],
  visibility: {},
  columnOrder: ['full_name', 'email', 'roles', 'is_active', 'created_at'],
};

export function UsersListePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const isAdmin = user?.roles.includes('admin') ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search],
    queryFn: () =>
      userApi.list({ search: search.trim() || undefined, limit: 100 }),
    enabled: isAdmin,
  });

  const columns = useMemo<ColumnDef<UserRead>[]>(
    () => [
      {
        id: 'full_name',
        accessorKey: 'full_name',
        header: 'Name',
        cell: (ctx) => (
          <span className="font-medium text-zinc-100">{ctx.row.original.full_name}</span>
        ),
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'E-Mail',
        cell: (ctx) => <span className="text-zinc-300">{ctx.row.original.email}</span>,
      },
      {
        id: 'roles',
        accessorFn: (row) => row.roles.map((r) => r.name).join(', '),
        header: 'Rollen',
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
          columnFilters={[]}
          onColumnFiltersChange={() => {}}
          columnOrder={config.columnOrder}
          onColumnOrderChange={(o) => setConfig((p) => ({ ...p, columnOrder: o }))}
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
    </div>
  );
}
