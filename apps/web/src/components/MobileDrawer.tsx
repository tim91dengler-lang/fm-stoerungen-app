import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Activity, LogOut, X } from 'lucide-react';
import {
  navGroups,
  quickAccessItems,
  NavLinkItem,
  NavSection,
} from '../config/nav';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useNavActions } from '../hooks/useNavActions';

interface Props {
  open: boolean;
  onClose: () => void;
}

// 44px min touch target for drawer links/actions (mobile is touch-primary).
const TOUCH = 'min-h-11';

/**
 * Slide-in primary navigation for screens below `lg`. Mirrors the desktop
 * sidebar content (same nav data + item styling) and the TicketDetailPanel
 * overlay pattern (backdrop + aside), but slides from the left.
 */
export function MobileDrawer({ open, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isDesktop = useIsDesktop();
  const { newTicket, handleLogout } = useNavActions();

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Close on navigation (covers tapping the already-active route too).
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close if the viewport grows to desktop while open (sidebar takes over).
  useEffect(() => {
    if (open && isDesktop) onClose();
  }, [open, isDesktop, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex animate-fade motion-reduce:animate-none lg:hidden">
      {/* Panel (left) */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        id="main-drawer"
        aria-label="Hauptmenü"
        className="flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto overscroll-contain border-r border-zinc-800 bg-zinc-950 shadow-2xl outline-none animate-slide-in-left motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Menü schließen"
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="px-4">
          <button
            type="button"
            onClick={() => {
              newTicket();
              onClose();
            }}
            className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            <span className="text-lg leading-none">+</span> Neues Ticket
          </button>
        </div>

        <nav className="flex-1 space-y-5 px-3 pb-4">
          <NavSection label="Schnellzugriff">
            {quickAccessItems.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClose} className={TOUCH} />
            ))}
          </NavSection>
          {navGroups.map((group) => (
            <NavSection key={group.label} label={group.label}>
              {group.items.map((item) => (
                <NavLinkItem key={item.to} item={item} onClick={onClose} className={TOUCH} />
              ))}
            </NavSection>
          ))}
        </nav>

        <div className="mt-auto border-t border-zinc-800 px-3 py-3 pb-safe">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <LogOut className="h-4 w-4" /> Abmelden
          </button>
        </div>
      </aside>

      {/* Backdrop (right of the panel) — decorative, closes on tap. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="flex-1 bg-zinc-950/60 backdrop-blur-sm"
      />
    </div>,
    document.body,
  );
}
