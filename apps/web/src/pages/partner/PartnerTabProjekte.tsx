import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type { PartnerProjektLinkRead } from '../../api/types';

interface Props {
  partnerId: string;
  partnerName: string;
}

/**
 * Tab 4 — Verlinkte Projekte (Spec §5.3 / Tim 2026-04-20).
 *
 * Transitive Liste: Projekte, deren Objekte den aktuellen Partner als
 * Eigentümer/Mieter/Auftraggeber/etc. haben. Endpoint:
 * GET /partner/{id}/projekte. Backend bündelt die Rollen pro Projekt.
 */
export function PartnerTabProjekte({ partnerId, partnerName }: Props) {
  const q = useQuery({
    queryKey: ['partner', partnerId, 'projekte'],
    queryFn: () => partnerApi.listProjekte(partnerId),
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo<PartnerProjektLinkRead[]>(() => {
    if (!q.data) return [];
    if (!search) return q.data;
    const needle = search.toLowerCase();
    return q.data.filter((r) =>
      [r.name, r.status_label, r.projekttyp_label].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Projekte mit Bezug zu {partnerName}
        </h2>
        <span className="text-xs text-zinc-500">
          {filtered.length} von {q.data?.length ?? 0}
        </span>
        <span className="ml-2 text-[10px] text-zinc-600">
          (transitiv über Objekte ermittelt)
        </span>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Suche im Projektnamen / Status / Typ"
        className="w-80 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Projekt-Name</th>
              <th className="px-3 py-2 font-medium">Typ</th>
              <th className="px-3 py-2 font-medium">Rolle am Objekt</th>
              <th className="px-3 py-2 font-medium">Zeitraum</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Lade …
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Keine verlinkten Projekte gefunden.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.projekt_id}
                className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2 text-zinc-200">{r.name}</td>
                <td className="px-3 py-2 text-zinc-400">{r.projekttyp_label}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.rollen_an_objekten.join(', ') || '—'}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.start_am ?? '—'} – {r.ende_am ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <StatusPill label={r.status_label} farbe={r.status_farbe} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/projekte/${r.projekt_id}`}
                    className="text-zinc-400 hover:text-emerald-300"
                    aria-label="Zum Projekt"
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

function StatusPill({ label, farbe }: { label: string; farbe: string | null }) {
  const tone = colorTone(farbe);
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function colorTone(farbe: string | null): string {
  switch (farbe) {
    case 'blue':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-300';
    case 'emerald':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
    case 'amber':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
    case 'red':
      return 'border-red-500/30 bg-red-500/15 text-red-300';
    case 'violet':
      return 'border-violet-500/30 bg-violet-500/15 text-violet-300';
    case 'orange':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-300';
    default:
      return 'border-zinc-700 bg-zinc-800/40 text-zinc-300';
  }
}
