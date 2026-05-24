import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Ausrichtung } from '../api/types';

interface StockwerkFormValues {
  bezeichnung: string;
  ausrichtung: Ausrichtung | null;
}

interface StockwerkModalProps {
  open: boolean;
  /** If set, modal is in "edit" mode and form is pre-populated. */
  initial?: { bezeichnung: string; ausrichtung: Ausrichtung | null } | null;
  onClose: () => void;
  onSubmit: (values: StockwerkFormValues) => void;
  isPending?: boolean;
}

const EMPTY: StockwerkFormValues = { bezeichnung: '', ausrichtung: null };

const AUSRICHTUNG_OPTIONS: Array<{ value: Ausrichtung | ''; label: string }> = [
  { value: '', label: '– keine –' },
  { value: 'nord', label: 'Nord' },
  { value: 'ost', label: 'Ost' },
  { value: 'sued', label: 'Süd' },
  { value: 'west', label: 'West' },
];

export function StockwerkModal({
  open,
  initial,
  onClose,
  onSubmit,
  isPending = false,
}: StockwerkModalProps) {
  const [form, setForm] = useState<StockwerkFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        bezeichnung: initial.bezeichnung,
        ausrichtung: initial.ausrichtung,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [open, initial]);

  if (!open) return null;

  const isEdit = !!initial;

  function handleSubmit() {
    const bezeichnung = form.bezeichnung.trim();
    if (!bezeichnung) {
      setError('Bezeichnung ist Pflicht.');
      return;
    }
    onSubmit({ bezeichnung, ausrichtung: form.ausrichtung });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stockwerk-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="stockwerk-modal-title"
            className="flex items-center gap-2 text-lg font-semibold text-zinc-100"
          >
            <Layers className="h-5 w-5 text-sky-400" />
            {isEdit ? 'Stockwerk bearbeiten' : 'Neues Stockwerk'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Bezeichnung <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={form.bezeichnung}
              onChange={(e) =>
                setForm((f) => ({ ...f, bezeichnung: e.target.value }))
              }
              placeholder="z. B. EG, 1. OG"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Ausrichtung
            </label>
            <select
              value={form.ausrichtung ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ausrichtung:
                    e.target.value === ''
                      ? null
                      : (e.target.value as Ausrichtung),
                }))
              }
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {AUSRICHTUNG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-zinc-500">
              Optional – hilft beim Orientieren in Plänen.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {isPending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
