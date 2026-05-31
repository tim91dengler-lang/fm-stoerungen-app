import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { statusWorkflowApi } from '../api/endpoints';
import type { StatusWertMini } from '../api/types';

/**
 * Admin-Editor für die Status-Übergangsmatrix (Konzept "Das Ticket" §6.1).
 * Zeile = aktueller Status, Spalte = Ziel-Status. Im Ticket-Detail erscheinen
 * nur die hier erlaubten Übergänge als Workflow-Buttons.
 */
export function StatusWorkflowPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['status-workflow'],
    queryFn: () => statusWorkflowApi.get(),
  });

  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [erfordertGrund, setErfordertGrund] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data) {
      setMatrix(query.data.uebergaenge);
      setErfordertGrund(
        Object.fromEntries(query.data.status.map((s) => [s.key, s.erfordert_grund])),
      );
      setDirty(false);
    }
  }, [query.data]);

  const status: StatusWertMini[] = query.data?.status ?? [];

  const save = useMutation({
    mutationFn: () =>
      statusWorkflowApi.update({ uebergaenge: matrix, erfordert_grund: erfordertGrund }),
    onSuccess: (data) => {
      qc.setQueryData(['status-workflow'], data);
      setMatrix(data.uebergaenge);
      setErfordertGrund(Object.fromEntries(data.status.map((s) => [s.key, s.erfordert_grund])));
      setDirty(false);
    },
  });

  function toggle(von: string, nach: string) {
    setMatrix((prev) => {
      const cur = new Set(prev[von] ?? []);
      if (cur.has(nach)) cur.delete(nach);
      else cur.add(nach);
      return { ...prev, [von]: [...cur] };
    });
    setDirty(true);
  }

  function toggleGrund(key: string) {
    setErfordertGrund((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Status-Workflow</h1>
          <p className="text-sm text-zinc-500">
            Erlaubte Status-Übergänge je Mandant. Zeile = aktueller Status, Spalte = Ziel-Status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {save.isPending ? 'Speichert …' : 'Speichern'}
        </button>
      </div>

      {query.isLoading && <div className="text-sm text-zinc-500">Lädt …</div>}
      {query.isError && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Konnte den Status-Workflow nicht laden.
        </div>
      )}

      {status.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900/60">
                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  von ↓ / nach →
                </th>
                {status.map((s) => (
                  <th key={s.key} className="p-2 text-center text-xs font-medium text-zinc-300">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {status.map((von) => (
                <tr key={von.key} className="border-t border-zinc-800">
                  <td className="whitespace-nowrap p-2 text-xs font-medium text-zinc-300">
                    {von.label}
                  </td>
                  {status.map((nach) => {
                    const same = von.key === nach.key;
                    const checked = (matrix[von.key] ?? []).includes(nach.key);
                    return (
                      <td key={nach.key} className="p-2 text-center">
                        {same ? (
                          <span className="text-zinc-700">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggle(von.key, nach.key)}
                            aria-pressed={checked}
                            aria-label={`${von.label} nach ${nach.label} ${checked ? 'erlaubt' : 'gesperrt'}`}
                            className={clsx(
                              'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
                              checked
                                ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                                : 'border-zinc-700 bg-zinc-900 text-transparent hover:border-zinc-600',
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-zinc-200">„Wartet auf“-Hook</h2>
          <p className="mb-2 text-[11px] text-zinc-500">
            Status, die einen Sub-Grund verlangen. Beim Setzen erscheint im Ticket die
            Wartet-auf-Erfassung (Grund, Nachunternehmer, Kontakt).
          </p>
          <div className="flex flex-wrap gap-2">
            {status.map((s) => (
              <label
                key={s.key}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={!!erfordertGrund[s.key]}
                  onChange={() => toggleGrund(s.key)}
                  className="h-4 w-4 accent-emerald-500"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-zinc-500">
        Tipp: „Erledigt“ hat per Default keine Übergänge — ein Häkchen in der Erledigt-Zeile
        aktiviert ein gezieltes Wiedereröffnen.
      </p>
    </div>
  );
}
