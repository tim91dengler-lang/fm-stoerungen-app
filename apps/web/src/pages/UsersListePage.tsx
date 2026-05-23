import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../lib/format';

export function UsersListePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const isAdmin = user?.roles.includes('admin') ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search],
    queryFn: () =>
      userApi.list({ search: search.trim() || undefined, limit: 100 }),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Diese Ansicht ist nur für Admins. Wende dich an einen Admin, wenn du
          User-Zugriff brauchst.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Benutzer</h1>
          <p className="text-sm text-zinc-500">
            {data ? `${data.total} Treffer` : '—'}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <input
          type="search"
          placeholder="Suche in Name und E-Mail …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 bg-zinc-950 text-zinc-100"
        />
      </div>

      {isLoading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Lade …
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler beim Laden.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Keine Benutzer gefunden.
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">E-Mail</th>
                <th className="px-4 py-2 font-medium">Rollen</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Angelegt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-2 font-medium text-zinc-100">
                    {u.full_name}
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{u.email}</td>
                  <td className="px-4 py-2 text-zinc-300">
                    {u.roles.map((r) => r.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {u.is_active ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        aktiv
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                        inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">
                    {formatDateTime(u.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
