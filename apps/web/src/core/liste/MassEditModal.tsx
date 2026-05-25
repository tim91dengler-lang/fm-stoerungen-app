import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auswahllistenApi } from '../../api/endpoints';

/**
 * Mass-Edit modal for the list views (Stufe 1):
 *
 * Allows the user to pick a single column from a configurable list of
 * editable columns, choose a new value (text / auswahl / boolean), and
 * apply that value to every previously selected row via PATCH per id.
 *
 * The page owns the actual `onSubmit` mutation (so it can use its own
 * `qc.invalidateQueries` keys after success). This modal is purely a
 * generic dialog.
 *
 * Out of scope for Stufe 1: User-FK, multi-FK, date pickers.
 */
export type MassEditFieldType = 'text' | 'auswahl' | 'boolean';

export interface ColumnSpec {
  /** Backend field name as expected by the PATCH payload. */
  id: string;
  /** Human-readable column label shown to the user. */
  label: string;
  /** Editor type — drives which input is rendered. */
  type: MassEditFieldType;
  /**
   * For type 'auswahl': the key of the Auswahlliste (e.g. 'projektstatus',
   * 'ticket_kategorie'). Werte are loaded via auswahllistenApi.
   * The submitted value is the SLUG (`werte[i].key`), not the UUID.
   */
  auswahlKey?: string;
  /**
   * For type 'auswahl' WITHOUT an `auswahlKey`: explicit options.
   * Used when the field is a closed enum like PartnerTyp.
   * The submitted value is the option's `value`.
   */
  options?: { value: string; label: string }[];
  /**
   * For type 'auswahl': allow multiple values selected at once
   * (the submitted value is an array of slugs/option-values).
   * Default: false (single select).
   */
  multi?: boolean;
}

export interface MassEditResult {
  ok: number;
  failed: number;
}

export interface MassEditModalProps<TRow> {
  open: boolean;
  selectedRows: TRow[];
  columns: ColumnSpec[];
  /** Singular label, e.g. "Projekt" — used in the title and confirmation text. */
  itemLabel: { singular: string; plural: string };
  onClose: () => void;
  onSubmit: (columnId: string, value: unknown) => Promise<MassEditResult>;
}

export function MassEditModal<TRow>({
  open,
  selectedRows,
  columns,
  itemLabel,
  onClose,
  onSubmit,
}: MassEditModalProps<TRow>) {
  const [columnId, setColumnId] = useState<string>('');
  const [textValue, setTextValue] = useState('');
  const [auswahlSlug, setAuswahlSlug] = useState<string>('');
  const [auswahlMulti, setAuswahlMulti] = useState<string[]>([]);
  const [boolValue, setBoolValue] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MassEditResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset internal state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const first = columns[0];
    setColumnId(first?.id ?? '');
    setTextValue('');
    setAuswahlSlug('');
    setAuswahlMulti([]);
    setBoolValue(true);
    setBusy(false);
    setResult(null);
    setErrorMsg(null);
  }, [open, columns]);

  const activeColumn = useMemo(
    () => columns.find((c) => c.id === columnId) ?? null,
    [columns, columnId],
  );

  // Lazy-load all Auswahllisten once (cached) — they're tiny.
  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
    enabled: open && columns.some((c) => c.type === 'auswahl' && c.auswahlKey),
  });

  const auswahlOptions = useMemo<{ value: string; label: string }[]>(() => {
    if (!activeColumn || activeColumn.type !== 'auswahl') return [];
    if (activeColumn.options && activeColumn.options.length > 0)
      return activeColumn.options;
    if (!activeColumn.auswahlKey) return [];
    const liste = auswahllistenQuery.data?.find(
      (l) => l.key === activeColumn.auswahlKey,
    );
    if (!liste) return [];
    return [...liste.werte]
      .filter((w) => w.ist_aktiv)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
      .map((w) => ({ value: w.key, label: w.label }));
  }, [activeColumn, auswahllistenQuery.data]);

  if (!open) return null;

  function currentValue(): unknown {
    if (!activeColumn) return undefined;
    if (activeColumn.type === 'text') {
      // Empty string is treated as "clear field" via null — caller decides
      // whether the API accepts null vs empty string.
      return textValue;
    }
    if (activeColumn.type === 'boolean') return boolValue;
    if (activeColumn.type === 'auswahl') {
      return activeColumn.multi ? auswahlMulti : auswahlSlug;
    }
    return undefined;
  }

  function canSubmit(): boolean {
    if (busy || !activeColumn || selectedRows.length === 0) return false;
    if (activeColumn.type === 'auswahl') {
      if (activeColumn.multi) return auswahlMulti.length > 0;
      return auswahlSlug.length > 0;
    }
    // text + boolean: always submittable (text may be intentionally empty)
    return true;
  }

  async function handleSubmit() {
    if (!activeColumn) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await onSubmit(activeColumn.id, currentValue());
      setResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function previewText(): string {
    if (!activeColumn) return '';
    const n = selectedRows.length;
    const nounPart =
      n === 1
        ? `1 ${itemLabel.singular} wird`
        : `${n} ${itemLabel.plural} werden`;
    if (activeColumn.type === 'text') {
      return `${nounPart} auf „${textValue || '—'}" gesetzt`;
    }
    if (activeColumn.type === 'boolean') {
      return `${nounPart} auf „${boolValue ? 'Ja' : 'Nein'}" gesetzt`;
    }
    if (activeColumn.type === 'auswahl') {
      if (activeColumn.multi) {
        const labels = auswahlMulti.map(
          (v) => auswahlOptions.find((o) => o.value === v)?.label ?? v,
        );
        return `${nounPart} auf „${labels.join(', ') || '—'}" gesetzt`;
      }
      const label =
        auswahlOptions.find((o) => o.value === auswahlSlug)?.label ?? auswahlSlug;
      return `${nounPart} auf „${label || '—'}" gesetzt`;
    }
    return '';
  }

  function toggleMulti(v: string) {
    setAuswahlMulti((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">
            Mass-Edit ({selectedRows.length}{' '}
            {selectedRows.length === 1 ? itemLabel.singular : itemLabel.plural})
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {result === null && (
          <>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Spalte ändern
                </label>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  disabled={busy}
                >
                  {columns.length === 0 && (
                    <option value="">— keine editierbaren Spalten —</option>
                  )}
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {activeColumn && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">
                    Neuer Wert
                  </label>

                  {activeColumn.type === 'text' && (
                    <input
                      type="text"
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="Wert eingeben …"
                      disabled={busy}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    />
                  )}

                  {activeColumn.type === 'boolean' && (
                    <div className="inline-flex overflow-hidden rounded-md border border-zinc-700">
                      <button
                        type="button"
                        onClick={() => setBoolValue(true)}
                        disabled={busy}
                        className={`px-4 py-1.5 text-sm ${
                          boolValue
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        Ja
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoolValue(false)}
                        disabled={busy}
                        className={`px-4 py-1.5 text-sm ${
                          !boolValue
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        Nein
                      </button>
                    </div>
                  )}

                  {activeColumn.type === 'auswahl' && !activeColumn.multi && (
                    <select
                      value={auswahlSlug}
                      onChange={(e) => setAuswahlSlug(e.target.value)}
                      disabled={busy || auswahllistenQuery.isLoading}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    >
                      <option value="">— Wert wählen —</option>
                      {auswahlOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {activeColumn.type === 'auswahl' && activeColumn.multi && (
                    <div className="flex flex-wrap gap-1">
                      {auswahlOptions.map((o) => {
                        const active = auswahlMulti.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleMulti(o.value)}
                            disabled={busy}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              active
                                ? 'bg-emerald-500 text-zinc-950'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                      {auswahlOptions.length === 0 && (
                        <span className="text-xs text-zinc-500">
                          {auswahllistenQuery.isLoading
                            ? 'Lade Werte …'
                            : 'Keine Werte verfügbar'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeColumn && (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
                  {previewText()}
                </div>
              )}

              {errorMsg && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  Fehler: {errorMsg}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit()}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {busy ? 'Speichere …' : 'Speichern'}
              </button>
            </div>
          </>
        )}

        {result !== null && (
          <>
            <div
              className={`rounded-md border px-3 py-3 text-sm ${
                result.failed === 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              }`}
            >
              {result.failed === 0 ? (
                <>
                  <strong>
                    {result.ok}/{result.ok} erfolgreich
                  </strong>{' '}
                  aktualisiert.
                </>
              ) : (
                <>
                  <strong>
                    {result.ok}/{result.ok + result.failed} erfolgreich
                  </strong>
                  , {result.failed} mit Fehler.
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Schließen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
