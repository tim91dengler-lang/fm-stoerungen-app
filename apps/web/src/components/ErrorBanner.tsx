import { useEffect, useState } from 'react';

interface Entry {
  ts: number;
  type: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
}

/**
 * Globales Error-Display in der oberen rechten Ecke. Fängt alle unhandled
 * Errors + Promise-Rejections + console.error ab und zeigt sie sichtbar an.
 *
 * In der Hot-Iterations-Phase aktiv, damit Tester ohne DevTools sehen, was
 * los ist wenn das UI etwas Komisches macht.
 */
export function ErrorBanner() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    function pushEntry(e: Entry) {
      setEntries((prev) => [...prev.slice(-9), e]); // letzte 10 behalten
    }

    function onError(ev: ErrorEvent) {
      pushEntry({
        ts: Date.now(),
        type: 'error',
        message: ev.message,
        stack: ev.error?.stack,
      });
    }
    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason as unknown;
      const message =
        typeof reason === 'string'
          ? reason
          : reason instanceof Error
            ? reason.message
            : JSON.stringify(reason);
      pushEntry({
        ts: Date.now(),
        type: 'unhandledrejection',
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    }

    // console.error mitschneiden (für React-Warnings über infinite loops u. ä.)
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      origError(...args);
      const text = args
        .map((a) =>
          typeof a === 'string'
            ? a
            : a instanceof Error
              ? a.message
              : (() => {
                  try {
                    return JSON.stringify(a);
                  } catch {
                    return '[unserializable]';
                  }
                })(),
        )
        .join(' ')
        .slice(0, 500);
      // Heuristik: React's internal warnings haben „Warning:" oder „Maximum update depth"
      if (/(Maximum update depth|Cannot update|Hook|Warning:)/i.test(text)) {
        pushEntry({ ts: Date.now(), type: 'error', message: `[console.error] ${text}` });
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      console.error = origError;
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-2 right-2 z-[9999] flex max-h-[60vh] w-96 flex-col gap-1 overflow-y-auto">
      {entries.map((e) => (
        <div
          key={e.ts}
          className="rounded-md border border-red-500/40 bg-red-950/95 px-3 py-2 text-xs shadow-xl"
        >
          <div className="flex items-center justify-between text-red-300">
            <span className="font-semibold">{e.type}</span>
            <button
              type="button"
              onClick={() =>
                setEntries((prev) => prev.filter((x) => x.ts !== e.ts))
              }
              className="text-red-400 hover:text-red-200"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
          <div className="mt-1 break-words text-red-100">{e.message}</div>
          {e.stack && (
            <details className="mt-1 text-[10px] text-red-300/80">
              <summary className="cursor-pointer">Stack</summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                {e.stack}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
