import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
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
  MapPinned,
  Smartphone,
  Tags,
  Ticket,
  Users,
  Users2,
} from 'lucide-react';

// Single source of truth for navigation, shared by the desktop sidebar,
// the mobile drawer and the bottom tab bar (AppLayout + MobileDrawer + BottomTabBar).
// Behaviour callbacks (new ticket, logout) live in useNavActions, NOT here —
// they depend on hooks and must not leak into a plain data module.

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Top-of-list quick access (rendered above the grouped sections). */
export const quickAccessItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/meine-tickets', label: 'Meine Tickets', icon: <ListChecks className="h-4 w-4" /> },
];

export const navGroups: NavGroup[] = [
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
      { to: '/stammdaten/adressen', label: 'Adressen', icon: <MapPinned className="h-4 w-4" /> },
      { to: '/stammdaten/objekte', label: 'Objekte', icon: <Building2 className="h-4 w-4" /> },
      { to: '/stammdaten/partner', label: 'Geschäftspartner', icon: <Users2 className="h-4 w-4" /> },
      { to: '/stammdaten/anlagen', label: 'Anlagen', icon: <Activity className="h-4 w-4" /> },
      { to: '/stammdaten/fehlercodes', label: 'Fehlercodes', icon: <AlertOctagon className="h-4 w-4" /> },
      { to: '/stammdaten/vorlagen', label: 'Vorlagen', icon: <Layers className="h-4 w-4" /> },
      { to: '/stammdaten/auswahllisten', label: 'Auswahllisten', icon: <Tags className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/users', label: 'Benutzer', icon: <Users className="h-4 w-4" /> }],
  },
];

/**
 * Core actions for the mobile bottom tab bar (3 routes + a "Mehr" button that
 * opens the drawer, added in the component). Larger icons than sidebar items.
 */
export const bottomTabItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/tickets', label: 'Pool', icon: <Ticket className="h-5 w-5" /> },
  { to: '/meine-tickets', label: 'Meine', icon: <ListChecks className="h-5 w-5" /> },
];

// Shared item styling so the sidebar and the mobile drawer look identical.
export const navItemClass =
  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors';
export const navItemActive = 'bg-zinc-800 text-emerald-300';
export const navItemIdle = 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100';

/** A labelled group of nav links — shared by the sidebar and the drawer. */
export function NavSection({
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

/**
 * A single nav link with the shared active/idle styling. `onClick` lets the
 * drawer close itself on navigation; `className` lets it bump touch targets
 * (e.g. min-h-11) without affecting the compact desktop sidebar.
 */
export function NavLinkItem({
  item,
  onClick,
  className,
}: {
  item: NavItem;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(navItemClass, className, isActive ? navItemActive : navItemIdle)
      }
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge}
    </NavLink>
  );
}
