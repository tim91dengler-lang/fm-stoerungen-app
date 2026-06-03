import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Mail, Phone, Smartphone } from 'lucide-react';

import { objektstrukturApi } from '../../api/endpoints';
import type { Beteiligter, HausRead, KontaktMini } from '../../api/types';
import { RelationListTab } from '../../core/detail';

/**
 * Konsolidierte Beteiligten-Übersicht eines Objekts über ALLE Struktur-Ebenen
 * (Haus / Stockwerk / Einheit) in einer Liste (Master-Layout via `RelationListTab`
 * = volle PowerListenView mit Suche, Spaltenfiltern, Multi-Sort). Tim-Wunsch
 * 2026-06-03: „Listenansicht der Beteiligten pro Objekt".
 *
 * Datenquelle ist der bestehende Struktur-Baum (`listHaus`) — kein neuer Endpoint;
 * die Zeilen werden clientseitig aus den `beteiligte`-Listen der Knoten geflacht.
 */

interface BeteiligterRow {
  id: string;
  partnerId: string;
  ebene: string;
  ort: string;
  partner: string;
  rolle: string;
  kontakteText: string;
  kontakte: KontaktMini[];
}

function mkRow(ebene: string, ort: string, b: Beteiligter): BeteiligterRow {
  return {
    id: b.id,
    partnerId: b.partner_id,
    ebene,
    ort,
    partner: b.partner_name,
    rolle: b.rolle_label ?? '—',
    kontakteText: b.kontakte.map((k) => k.name).join(', '),
    kontakte: b.kontakte,
  };
}

function flatten(haeuser: HausRead[]): BeteiligterRow[] {
  const rows: BeteiligterRow[] = [];
  for (const h of haeuser) {
    for (const b of h.beteiligte) rows.push(mkRow('Haus', h.bezeichnung, b));
    for (const s of h.stockwerke) {
      const swOrt = `${h.bezeichnung} › ${s.bezeichnung}`;
      for (const b of s.beteiligte) rows.push(mkRow('Stockwerk', swOrt, b));
      for (const e of s.einheiten) {
        const eOrt = `${swOrt} › ${e.bezeichnung}`;
        for (const b of e.beteiligte) rows.push(mkRow('Einheit', eOrt, b));
      }
    }
  }
  return rows;
}

function KontakteCell({ kontakte }: { kontakte: KontaktMini[] }) {
  if (kontakte.length === 0) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {kontakte.map((k) => (
        <div key={k.id} className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="text-zinc-200">{k.name}</span>
          {k.email && (
            <a
              href={`mailto:${k.email}`}
              className="inline-flex items-center gap-0.5 text-sky-300 hover:underline"
              title={k.email}
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3 w-3" />
            </a>
          )}
          {k.telefon && (
            <a
              href={`tel:${k.telefon}`}
              className="inline-flex items-center gap-0.5 text-emerald-300 hover:underline"
              title={k.telefon}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-3 w-3" />
            </a>
          )}
          {k.mobil && (
            <a
              href={`tel:${k.mobil}`}
              className="inline-flex items-center gap-0.5 text-emerald-300 hover:underline"
              title={k.mobil}
              onClick={(e) => e.stopPropagation()}
            >
              <Smartphone className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

const columns: ColumnDef<BeteiligterRow>[] = [
  { id: 'ebene', accessorKey: 'ebene', header: 'Ebene' },
  { id: 'ort', accessorKey: 'ort', header: 'Ort' },
  { id: 'partner', accessorKey: 'partner', header: 'Partner' },
  { id: 'rolle', accessorKey: 'rolle', header: 'Rolle' },
  {
    id: 'kontakte',
    accessorFn: (r) => r.kontakteText,
    header: 'Ansprechpartner',
    cell: (c) => <KontakteCell kontakte={c.row.original.kontakte} />,
  },
];

export function ObjektBeteiligteTab({
  objektId,
  onPartner,
}: {
  objektId: string;
  onPartner: (partnerId: string) => void;
}) {
  const q = useQuery({
    queryKey: ['objekt-tree', objektId],
    queryFn: () => objektstrukturApi.listHaus(objektId),
  });
  const rows = useMemo(() => flatten(q.data ?? []), [q.data]);

  return (
    <RelationListTab<BeteiligterRow>
      viewKey="objekt-beteiligte"
      loading={q.isLoading}
      columns={columns}
      data={rows}
      getSearchText={(r) =>
        `${r.ebene} ${r.ort} ${r.partner} ${r.rolle} ${r.kontakteText}`
      }
      onRowClick={(r) => onPartner(r.partnerId)}
      searchPlaceholder="In Beteiligten suchen … (Partner, Rolle, Ort, Ansprechpartner)"
      itemLabel={{ singular: 'Beteiligter', plural: 'Beteiligte' }}
    />
  );
}
