import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Thin banner shown while the device is offline. The app shell stays usable
 * (precached by the service worker), but data fetches fail — this tells the
 * user why, instead of leaving them with silent errors.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // The live region is rendered permanently (only its content changes) so
  // screen readers reliably announce the transition into offline — injecting a
  // pre-filled aria-live region is announced unreliably across AT.
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        offline
          ? 'flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-300'
          : 'sr-only'
      }
    >
      {offline && (
        <>
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Offline — Daten können gerade nicht aktualisiert werden.
        </>
      )}
    </div>
  );
}
