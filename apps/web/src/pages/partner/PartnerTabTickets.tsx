import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { partnerApi } from '../../api/endpoints';
import type { PartnerTicketLinkRead } from '../../api/types';

interface Props {
  partnerId: string;
  partnerName: string;
}

/**
 * Tab 5 — Verlinkte Tickets (Spec §5.3 / Mockup Tab 5).
 *
 * Default: nur offene/in-Arbeit. Erledigte werden per Toggle zugeschaltet
 * (Endpoint-Param `include_erledigt`). 4 Default-Spalten: # / Titel / Status / Objekt.
 * Zuschaltbar: Priorität, Erstellt am, Melder.
 */
export function PartnerTabTickets({ partnerId, partnerName }: Props) {
  const [includeErledigt, setIncludeErledigt] = useState(false);
  const [search, setSearch] = useState('');
  const [showOptional, setShowOptional] = useState<{
    prio: boolean;
    erstellt: boolean;
  }>({ prio: false, erstellt: false });

  const q = useQuery({
    queryKey: ['partner', partnerId, 'tickets', includeErledigt],
    queryFn: () => partnerApi.listTickets(partnerId, includeErledigt),
  });

  const filtered = useMemo<PartnerTicketLinkRead[]>(() => {
    if (!q.data) return [];
    if (!search) return q.data;
    const needle = search.toLowerCase();
    return q.data.filter((r) =>
      [r.titel, r.status_label, r.objekt_name ?? '', `#${r.nummer}`].some(
        (v) => v.toLowerCase().includes(needle),
      ),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Tickets mit Bezug zu {partnerName}
        </h2>
        <span className="text-xs text-zinc-500">
          {filtered.length} {includeErledigt ? '(inkl. erledigte)' : '(offen + in Arbeit)'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Suche nach Nr / Titel / Objekt / Melder"
          className="w-80 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        />
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={includeErledigt}
            onChange={(e) => setIncludeErledigt(e.target.checked)}
            className="accent-emerald-500"
          />
          Erledigte einblenden
        </label>

        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
          <span>Spalten:</span>
          <ColCheck
            label="Priorität"
            checked={showOptional.prio}
            onToggle={(v) => setShowOptional((s) => ({ ...s, prio: v }))}
          />
          <ColCheck
            label="Erstellt"
            checked={showOptional.erstellt}
            onToggle={(v) => setShowOptional((s) => ({ ...s, erstellt: v }))}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Titel</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Objekt</th>
              {showOptional.prio && (
                <th className="px-3 py-2 font-medium">Priorität</th>
              )}
              {showOptional.erstellt && (
                <th className="px-3 py-2 font-medium">Erstellt</th>
              )}
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Lade …
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-zinc-500">
                  Keine verlinkten Tickets gefunden.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.ticket_id}
                className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                  #{r.nummer}
                </td>
                <td className="px-3 py-2 text-zinc-200">{r.titel}</td>
                <td className="px-3 py-2">
                  <StatusPill label={r.status_label} farbe={r.status_farbe} />
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.objekt_name ?? '—'}</td>
                {showOptional.prio && (
                  <td className="px-3 py-2">
                    <StatusPill label={r.prioritaet_label} farbe={r.prioritaet_farbe} />
                  </td>
                )}
                {showOptional.erstellt && (
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {new Date(r.eroeffnet_am).toLocaleDateString('de-DE')}
                  </td>
                )}
                <td className="px-3 py-2">
                  <Link
                    to={`/tickets/${r.ticket_id}`}
                    className="text-zinc-400 hover:text-emerald-300"
                    aria-label="Zum Ticket"
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

function ColCheck({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-emerald-500"
      />
      {label}
    </label>
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
    case 'sky':
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
    case 'slate':
      return 'border-zinc-700 bg-zinc-800/60 text-zinc-300';
    default:
      return 'border-zinc-700 bg-zinc-800/40 text-zinc-300';
  }
}
