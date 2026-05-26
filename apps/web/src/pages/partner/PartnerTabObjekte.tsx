import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';

import { partnerApi } from '../../api/endpoints';
import type { PartnerObjektLinkRead } from '../../api/types';

interface Props {
  partnerId: string;
  partnerName: string;
}

const ROLLE_LABEL: Record<string, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
  auftraggeber: 'Auftraggeber',
  nachunternehmer: 'Nachunternehmer',
  privatperson: 'Privatperson',
};

/**
 * Tab 3 — Verlinkte Objekte (Spec §5.3 + Mockup Tab 3).
 *
 * Schlanke Read-only-Tabelle mit Suche + Rollen-Filter. Kein PowerListenView
 * (Tims Entscheidung, weil das abgeleitete Daten sind, keine Stammdaten).
 */
export function PartnerTabObjekte({ partnerId, partnerName }: Props) {
  const q = useQuery({
    queryKey: ['partner', partnerId, 'objekte'],
    queryFn: () => partnerApi.listObjekte(partnerId),
  });

  const [search, setSearch] = useState('');
  const [rolleFilter, setRolleFilter] = useState<string>('');

  const allRollen = useMemo(() => {
    const set = new Set<string>();
    for (const o of q.data ?? []) o.rollen.forEach((r) => set.add(r));
    return Array.from(set).sort();
  }, [q.data]);

  const filtered = useMemo<PartnerObjektLinkRead[]>(() => {
    let rows = q.data ?? [];
    if (rolleFilter) rows = rows.filter((r) => r.rollen.includes(rolleFilter));
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.objekt_name, r.adresse_kurz ?? '']
          .some((v) => v.toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [q.data, search, rolleFilter]);

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Objekte mit Bezug zu {partnerName}
        </h2>
        <span className="text-xs text-zinc-500">
          {filtered.length} von {q.data?.length ?? 0}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Suche im Objektnamen / der Adresse"
          className="w-72 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={rolleFilter}
          onChange={(e) => setRolleFilter(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100"
        >
          <option value="">Alle Rollen</option>
          {allRollen.map((r) => (
            <option key={r} value={r}>
              {ROLLE_LABEL[r] ?? r}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Objekt-Name</th>
              <th className="px-3 py-2 font-medium">Rolle</th>
              <th className="px-3 py-2 font-medium">Adresse</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Lade …
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Keine verlinkten Objekte gefunden.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.objekt_id}
                className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
              >
                <td
                  className={clsx(
                    'px-3 py-2',
                    r.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-200',
                  )}
                >
                  {r.objekt_name}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {r.rollen
                    .map((rr) => ROLLE_LABEL[rr] ?? rr)
                    .join(', ')}
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.adresse_kurz ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.gesperrt ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                      gesperrt
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400">aktiv</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/stammdaten/objekte/${r.objekt_id}`}
                    className="text-zinc-400 hover:text-emerald-300"
                    aria-label="Zum Objekt"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
