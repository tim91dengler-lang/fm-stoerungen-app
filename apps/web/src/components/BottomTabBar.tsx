import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Menu } from 'lucide-react';
import { bottomTabItems } from '../config/nav';

interface Props {
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}

const tabBase =
  'relative flex flex-1 min-h-[3.5rem] flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500';

/**
 * Fixed bottom navigation for the technician's core actions, visible only below
 * `lg`. Three route tabs plus a "Mehr" button that opens the full drawer.
 */
export function BottomTabBar({ drawerOpen, onOpenDrawer }: Props) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-800 bg-zinc-950/90 pb-safe backdrop-blur-md lg:hidden"
    >
      {bottomTabItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              tabBase,
              isActive
                ? 'font-semibold text-emerald-300 after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:rounded-full after:bg-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200',
            )
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Mehr — Menü öffnen"
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        aria-controls="main-drawer"
        className={clsx(tabBase, 'text-zinc-400 hover:text-zinc-200')}
      >
        <Menu className="h-5 w-5" aria-hidden />
        <span>Mehr</span>
      </button>
    </nav>
  );
}
