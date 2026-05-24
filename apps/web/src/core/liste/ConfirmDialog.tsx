import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/* Reusable confirm modal for destructive bulk-actions.
 *
 * Why a custom modal instead of `window.confirm()`:
 * `confirm()` blocks the browser's event loop, can't be styled, looks
 * native-OS (out of place in our dark UI), and is flagged in F3-spec
 * as a no-go for destructive workflows. This component renders a
 * proper themed modal with focus-trap-light (auto-focus on cancel),
 * ESC-to-close and a backdrop click-to-close.
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body text or arbitrary React content (e.g., list of items to be deleted). */
  message: React.ReactNode;
  /** Label for the destructive action button. Default: "Löschen". */
  confirmLabel?: string;
  /** Label for the cancel button. Default: "Abbrechen". */
  cancelLabel?: string;
  /** Tone of the confirm button. `danger` = red, `primary` = emerald. Default: danger. */
  tone?: 'danger' | 'primary';
  /** Set to true while the mutation is pending — disables both buttons. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-500 text-zinc-950 hover:bg-red-400'
      : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          {tone === 'danger' && (
            <div className="rounded-full bg-red-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
          )}
          <div className="flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-zinc-100"
            >
              {title}
            </h2>
            <div className="mt-1 text-sm text-zinc-300">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {cancelLabel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              autoFocus
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus={!cancelLabel}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? 'Lädt …' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
