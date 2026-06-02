import { useEffect } from 'react';

/**
 * Zentriertes Detail-Overlay über der sichtbar bleibenden Liste
 * (Master-Layout-Standard §5.2 / Schichten-Modell §3: Liste = Basis, Detail
 * liegt mittig darüber). Esc und Klick auf den Backdrop schließen. Breite:
 * `panel` für flache Datensätze, `page` für Aggregate mit eigener Innenwelt.
 */
export interface DetailOverlayProps {
  open: boolean;
  onClose: () => void;
  width?: 'panel' | 'page';
  /** z-Index-Stufe — höhere Werte für verschachtelte Overlays (Ebene 3). */
  level?: 1 | 2;
  children: React.ReactNode;
}

export function DetailOverlay({
  open,
  onClose,
  width = 'panel',
  level = 1,
  children,
}: DetailOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const maxW = width === 'page' ? 'max-w-6xl' : 'max-w-3xl';
  const z = level === 2 ? 'z-50' : 'z-40';
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className={`fixed inset-0 ${z} flex items-start justify-center bg-black/60 p-4 sm:p-8`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full ${maxW} flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-2xl`}
        style={{ maxHeight: '92vh' }}
      >
        {children}
      </div>
    </div>
  );
}
