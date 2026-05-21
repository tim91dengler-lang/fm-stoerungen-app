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
          <h1 className="text-2xl font-semibold text-slate-900">Benutzer</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.total} Treffer` : '—'}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="search"
          placeholder="Suche in Name und E-Mail …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Lade …
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler beim Laden.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Keine Benutzer gefunden.
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">E-Mail</th>
                <th className="px-4 py-2 font-medium">Rollen</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Angelegt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {u.full_name}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{u.email}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {u.roles.map((r) => r.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {u.is_active ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        aktiv
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
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
