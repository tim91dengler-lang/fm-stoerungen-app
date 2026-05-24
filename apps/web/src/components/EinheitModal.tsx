import { useEffect, useMemo, useState } from 'react';
import { Check, DoorOpen, Search, X } from 'lucide-react';
import clsx from 'clsx';

interface PartnerOption {
  id: string;
  name: string;
  typen: string[];
}

interface EinheitFormValues {
  bezeichnung: string;
  groesse_qm: number | null;
  mieter_ids: string[];
}

interface EinheitModalProps {
  open: boolean;
  /** If set, modal is in "edit" mode and form is pre-populated. */
  initial?: {
    bezeichnung: string;
    groesse_qm: number | null;
    mieter_ids: string[];
  } | null;
  /** All known partners — modal filters internally for Mieter typ. */
  partner: PartnerOption[];
  onClose: () => void;
  onSubmit: (values: EinheitFormValues) => void;
  isPending?: boolean;
}

const EMPTY: EinheitFormValues = {
  bezeichnung: '',
  groesse_qm: null,
  mieter_ids: [],
};

export function EinheitModal({
  open,
  initial,
  partner,
  onClose,
  onSubmit,
  isPending = false,
}: EinheitModalProps) {
  const [form, setForm] = useState<EinheitFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [mieterSearch, setMieterSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        bezeichnung: initial.bezeichnung,
        groesse_qm: initial.groesse_qm,
        mieter_ids: [...initial.mieter_ids],
      });
    } else {
      setForm(EMPTY);
    }
    setMieterSearch('');
    setError(null);
  }, [open, initial]);

  // Filter on Mieter typ; partner-list comes from outside (may include all typ)
  const mieterPartner = useMemo(
    () => partner.filter((p) => p.typen.includes('mieter')),
    [partner],
  );

  const filteredMieter = useMemo(() => {
    const q = mieterSearch.trim().toLowerCase();
    if (!q) return mieterPartner;
    return mieterPartner.filter((p) => p.name.toLowerCase().includes(q));
  }, [mieterPartner, mieterSearch]);

  if (!open) return null;

  const isEdit = !!initial;
  const selectedSet = new Set(form.mieter_ids);

  function toggleMieter(id: string) {
    setForm((f) => {
      const next = new Set(f.mieter_ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, mieter_ids: Array.from(next) };
    });
  }

  function handleSubmit() {
    const bezeichnung = form.bezeichnung.trim();
    if (!bezeichnung) {
      setError('Bezeichnung ist Pflicht.');
      return;
    }
    onSubmit({
      bezeichnung,
      groesse_qm: form.groesse_qm,
      mieter_ids: form.mieter_ids,
    });
  }

  const selectedMieter = mieterPartner.filter((p) => selectedSet.has(p.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="einheit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="einheit-modal-title"
            className="flex items-center gap-2 text-lg font-semibold text-zinc-100"
          >
            <DoorOpen className="h-5 w-5 text-amber-400" />
            {isEdit ? 'Einheit bearbeiten' : 'Neue Einheit'}
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

        <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
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
              placeholder="z. B. EG-01, Wohnung 3"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Größe (m²)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.groesse_qm ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  groesse_qm:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="optional"
              className="w-32 rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Mieter ({selectedMieter.length} ausgewählt)
            </label>

            {selectedMieter.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {selectedMieter.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => toggleMieter(p.id)}
                      className="rounded-full p-0.5 hover:bg-amber-500/20"
                      aria-label={`${p.name} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={mieterSearch}
                onChange={(e) => setMieterSearch(e.target.value)}
                placeholder="Mieter suchen …"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950/40 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/30 p-1">
              {mieterPartner.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-zinc-500">
                  Keine Mieter angelegt. Lege Mieter unter Stammdaten → Partner an.
                </p>
              ) : filteredMieter.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-zinc-500">
                  Keine Treffer für „{mieterSearch}&quot;.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredMieter.map((p) => {
                    const active = selectedSet.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggleMieter(p.id)}
                          className={clsx(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                              : 'text-zinc-300 hover:bg-zinc-800',
                          )}
                        >
                          <span>{p.name}</span>
                          {active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
