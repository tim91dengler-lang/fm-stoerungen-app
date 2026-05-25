import { type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  AlertOctagon,
  Building2,
  Columns3,
  FolderKanban,
  FileStack,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Smartphone,
  Tags,
  Ticket,
  Users,
  Users2,
  MapPinned,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationsDropdown } from './NotificationsDropdown';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Betrieb',
    items: [
      { to: '/tickets', label: 'Ticket-Pool', icon: <Ticket className="h-4 w-4" /> },
      { to: '/kanban', label: 'Kanban', icon: <Columns3 className="h-4 w-4" /> },
      { to: '/wartungen', label: 'Wartungen', icon: <ListChecks className="h-4 w-4" /> },
      { to: '/projekte', label: 'Projekte', icon: <FolderKanban className="h-4 w-4" /> },
      { to: '/dokumente', label: 'Dokumente', icon: <FileStack className="h-4 w-4" /> },
      { to: '/mobile-demo', label: 'Mobile-Vorschau', icon: <Smartphone className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Stammdaten',
    items: [
      {
        to: '/stammdaten/adressen',
        label: 'Adressen',
        icon: <MapPinned className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/objekte',
        label: 'Objekte',
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/partner',
        label: 'Geschäftspartner',
        icon: <Users2 className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/anlagen',
        label: 'Anlagen',
        icon: <Activity className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/fehlercodes',
        label: 'Fehlercodes',
        icon: <AlertOctagon className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/vorlagen',
        label: 'Vorlagen',
        icon: <Layers className="h-4 w-4" />,
      },
      {
        to: '/stammdaten/auswahllisten',
        label: 'Auswahllisten',
        icon: <Tags className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', label: 'Benutzer', icon: <Users className="h-4 w-4" /> },
    ],
  },
];

function initialsFor(fullName?: string): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function todayLong(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function firstName(fullName?: string): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function newTicket() {
    navigate('/tickets?new=1');
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 lg:flex">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600">
            <Activity className="h-5 w-5 text-zinc-950" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-zinc-100">
              FM Störungen
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Stufe 1
            </div>
          </div>
        </div>

        <div className="px-4">
          <button
            type="button"
            onClick={newTicket}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            <span className="text-lg leading-none">+</span> Neues Ticket
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3">
          <SidebarGroup label="Schnellzugriff">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                clsx(itemClass, isActive ? itemActive : itemIdle)
              }
            >
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </NavLink>
            <NavLink
              to="/meine-tickets"
              className={({ isActive }) =>
                clsx(itemClass, isActive ? itemActive : itemIdle)
              }
            >
              <ListChecks className="h-4 w-4" /> Meine Tickets
            </NavLink>
          </SidebarGroup>

          {navGroups.map((group) => (
            <SidebarGroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(itemClass, isActive ? itemActive : itemIdle)
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.badge}
                </NavLink>
              ))}
            </SidebarGroup>
          ))}
        </nav>

        <div className="border-t border-zinc-800 px-3 py-3">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Angemeldet
          </div>
          <div className="flex items-center gap-2 rounded-md bg-zinc-900 px-2 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-xs font-semibold text-emerald-300">
              {initialsFor(user?.full_name)}
            </div>
            <div className="flex-1 truncate text-sm font-medium text-zinc-200">
              {user?.full_name ?? 'Gast'}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">{todayLong()}</div>
            <div className="truncate text-lg font-semibold text-zinc-100">
              Hallo, {firstName(user?.full_name) || 'Gast'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 sm:flex">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              System aktiv
            </div>
            <NotificationsDropdown />
            <button
              type="button"
              onClick={handleLogout}
              className="hidden items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 lg:flex"
              title="Abmelden"
            >
              <Settings className="h-3.5 w-3.5" /> Abmelden
            </button>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/20 text-xs font-semibold text-emerald-300"
              title={user?.full_name}
            >
              {initialsFor(user?.full_name)}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-auto bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const itemClass =
  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors';
const itemActive = 'bg-zinc-800 text-emerald-300';
const itemIdle = 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100';

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
