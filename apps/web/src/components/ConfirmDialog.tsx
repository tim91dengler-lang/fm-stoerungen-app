import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variant for the confirm button: danger (red) or default (emerald). */
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

/**
 * Reusable confirm dialog — replaces browser-native `confirm()` calls.
 *
 * Pattern: fixed overlay + centered card, role="dialog" for a11y,
 * matches the look & feel of the rest of the app.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'default',
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-500 text-zinc-50 hover:bg-red-400 disabled:bg-zinc-700 disabled:text-zinc-500'
      : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          {variant === 'danger' && (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
          )}
          <h2
            id="confirm-dialog-title"
            className="text-base font-semibold text-zinc-100"
          >
            {title}
          </h2>
        </div>
        <p className="mb-5 whitespace-pre-line text-sm text-zinc-300">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium ${confirmClass}`}
          >
            {isPending ? 'Wird ausgeführt …' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
