import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { projektApi } from '../../api/endpoints';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  RelationList,
  type DetailChip,
} from '../../core/detail';

/**
 * Referenz-Modul (Master-Layout-Standard, Slice 1 PR 2): Projekt-Detail als
 * zentriertes Overlay über der Liste, datengetrieben in Blöcke/Regionen nach
 * Konzept §6.4. Verknüpfungen (Objekte, Tickets) öffnen Ebene 3 = eine
 * vorgefilterte Liste. Hinter Flag `modul_standard`.
 */

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300">
        {empty ? <span className="text-zinc-600">—</span> : value}
      </div>
    </div>
  );
}

function Area({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="min-h-[2.25rem] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-300">
        {value ? value : <span className="text-zinc-600">— leer —</span>}
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded bg-zinc-700/40 px-2 py-0.5 text-xs font-medium text-zinc-200">
      {label}
    </span>
  );
}

const grid = 'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2';
const fmtDate = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : null);

/** Ebene-3-Liste (vorgefilterte Verknüpfungs-Liste, durchsuchbar). */
interface RelRow {
  id: string;
  search: string;
  cells: React.ReactNode[];
}
function RelationOverlayList({
  title,
  subtitle,
  columns,
  rows,
  onClose,
}: {
  title: string;
  subtitle: string;
  columns: string[];
  rows: RelRow[];
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => (q ? rows.filter((r) => r.search.toLowerCase().includes(q.toLowerCase())) : rows),
    [rows, q],
  );
  return (
    <DetailOverlay open onClose={onClose} width="page" level={2}>
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          <div className="text-xs text-zinc-500">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ← zurück zum Detail
        </button>
      </div>
      <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`🔎 In ${rows.length} Einträgen suchen …`}
          className="w-full max-w-sm rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600"
        />
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} / {rows.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-950 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                {r.cells.map((cell, i) => (
                  <td key={i} className="px-4 py-2.5 text-zinc-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-zinc-600">
                  Keine Treffer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DetailOverlay>
  );
}

export function ProjektDetailOverlay({
  projektId,
  onClose,
}: {
  projektId: string;
  onClose: () => void;
}) {
  const projektQuery = useQuery({
    queryKey: ['projekt', projektId],
    queryFn: () => projektApi.get(projektId),
  });
  const ticketsQuery = useQuery({
    queryKey: ['projekt-tickets', projektId],
    queryFn: () => projektApi.getTickets(projektId, { limit: 200 }),
  });
  const [rel, setRel] = useState<null | 'tickets' | 'objekte'>(null);

  const p = projektQuery.data;
  const tickets = ticketsQuery.data?.items ?? [];
  const ticketTotal = ticketsQuery.data?.total ?? tickets.length;

  const chips: DetailChip[] = [
    { label: 'Stammdaten', blockKey: 'stammdaten' },
    { label: 'Objekte', isRelation: true, onClick: () => setRel('objekte') },
    { label: 'Tickets', isRelation: true, onClick: () => setRel('tickets') },
    { label: 'Klassifizierung', blockKey: 'klassifizierung' },
    { label: 'Termine', blockKey: 'termine' },
  ];

  return (
    <DetailOverlay open onClose={onClose} width="panel">
      {projektQuery.isLoading || !p ? (
        <div className="p-8 text-sm text-zinc-500">
          {projektQuery.isError ? 'Projekt konnte nicht geladen werden.' : 'Lade Projekt …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={p.name}
            subtitle={`Projekt · ${[fmtDate(p.start_am), fmtDate(p.ende_am)].filter(Boolean).join(' – ') || 'ohne Zeitraum'}`}
            badges={[{ label: p.status.label }, { label: p.projekttyp.label }]}
            chips={chips}
            onClose={onClose}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <DetailRegions
              left={
                <>
                  <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={2}>
                    <div className={grid}>
                      <Field label="Projektname" value={p.name} />
                      <div className="sm:col-span-2">
                        <Area label="Beschreibung" value={p.beschreibung} />
                      </div>
                    </div>
                  </DetailBlock>
                  <DetailBlock
                    title="Objekte"
                    blockKey="objekte"
                    isRelation
                    defaultOpen
                    count={p.objekte.length}
                  >
                    <RelationList
                      items={p.objekte.map((o) => ({ id: o.id, label: o.name }))}
                      total={p.objekte.length}
                      onOpenList={() => setRel('objekte')}
                      emptyLabel="— keine Objekte verknüpft —"
                    />
                  </DetailBlock>
                  <DetailBlock
                    title="Tickets im Projekt"
                    blockKey="tickets"
                    isRelation
                    defaultOpen
                    count={ticketTotal}
                  >
                    <RelationList
                      items={tickets.map((t) => ({
                        id: t.id,
                        label: `#${t.nummer} ${t.titel}`,
                        trailing: <Badge label={t.status.label} />,
                      }))}
                      total={ticketTotal}
                      onOpenList={() => setRel('tickets')}
                      emptyLabel="— keine Tickets im Projekt —"
                    />
                  </DetailBlock>
                  <DetailBlock title="Notizen" blockKey="notizen" count={1}>
                    <div className={grid}>
                      <Area label="Notizen" value={p.notizen} />
                    </div>
                  </DetailBlock>
                </>
              }
              right={
                <>
                  <DetailBlock title="Klassifizierung" blockKey="klassifizierung" defaultOpen count={2}>
                    <div className={grid}>
                      <Field label="Projekttyp" value={<Badge label={p.projekttyp.label} />} />
                      <Field label="Status" value={<Badge label={p.status.label} />} />
                    </div>
                  </DetailBlock>
                  <DetailBlock title="Verantwortung & Termine" blockKey="termine" defaultOpen count={3}>
                    <div className={grid}>
                      <Field label="Verantwortlich" value={p.verantwortlich?.full_name} />
                      <Field label="Start am" value={fmtDate(p.start_am)} />
                      <Field label="Ende am" value={fmtDate(p.ende_am)} />
                    </div>
                  </DetailBlock>
                  <DetailBlock title="Historie" blockKey="historie" count={4}>
                    <div className={grid}>
                      <Field label="Ticket-Anzahl" value={p.ticket_count} />
                      <Field label="Angelegt am" value={fmtDate(p.created_at)} />
                      <Field label="Zuletzt geändert am" value={fmtDate(p.updated_at)} />
                      <Field label="Interne ID" value={p.id} />
                    </div>
                  </DetailBlock>
                </>
              }
            />
          </div>
        </>
      )}

      {rel === 'objekte' && p && (
        <RelationOverlayList
          title="Verknüpfte Objekte"
          subtitle={`vorgefiltert auf „${p.name}" · ${p.objekte.length} Einträge`}
          columns={['Objekt']}
          rows={p.objekte.map((o) => ({ id: o.id, search: o.name, cells: [o.name] }))}
          onClose={() => setRel(null)}
        />
      )}
      {rel === 'tickets' && p && (
        <RelationOverlayList
          title="Tickets im Projekt"
          subtitle={`vorgefiltert auf „${p.name}" · ${ticketTotal} Einträge`}
          columns={['Nr.', 'Titel', 'Status', 'Priorität']}
          rows={tickets.map((t) => ({
            id: t.id,
            search: `${t.nummer} ${t.titel} ${t.status.label}`,
            cells: [
              <span key="nr" className="font-medium text-zinc-100">
                #{t.nummer}
              </span>,
              t.titel,
              <Badge key="status" label={t.status.label} />,
              <Badge key="prio" label={t.prioritaet.label} />,
            ],
          }))}
          onClose={() => setRel(null)}
        />
      )}
    </DetailOverlay>
  );
}
