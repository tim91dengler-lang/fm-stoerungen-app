import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';

interface NavGroup {
  label: string;
  items: { to: string; label: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Betrieb',
    items: [{ to: '/tickets', label: 'Tickets' }],
  },
  {
    label: 'Stammdaten',
    items: [
      { to: '/stammdaten/adressen', label: 'Adressen' },
      { to: '/stammdaten/objekte', label: 'Objekte' },
      { to: '/stammdaten/partner', label: 'Partner' },
      { to: '/stammdaten/auswahllisten', label: 'Auswahllisten' },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/users', label: 'Benutzer' }],
  },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Sidebar umschalten"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="text-lg font-semibold text-brand-700">FM-Störungen</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">
                {user?.full_name ?? 'Gast'}
              </div>
              <div className="text-xs text-slate-500">
                {user?.roles.join(', ') ?? '—'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={clsx(
            'flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white transition-all',
            sidebarOpen ? 'w-56' : 'w-0',
          )}
        >
          <nav className="space-y-6 px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          'rounded-md px-3 py-1.5 text-sm font-medium',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-700 hover:bg-slate-100',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-x-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
