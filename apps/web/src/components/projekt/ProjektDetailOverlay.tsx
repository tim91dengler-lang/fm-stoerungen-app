import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { projektApi } from '../../api/endpoints';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  RelationListView,
  type DetailTab,
} from '../../core/detail';

/**
 * Referenz-Modul (Master-Layout-Standard, Reiter-Modell ab 2026-06-02): Projekt-
 * Detail als zentriertes Overlay über der Liste. Top-Navigation = Reiter
 * (`DetailTabs`): „Übersicht" (Felder als Block-Engine) + Verknüpfungs-Reiter
 * „Objekte"/„Tickets" mit voller Liste + Suche **inline** (kein gestapeltes
 * Fenster). Tickets werden **lazy** geladen (eigene Komponente, nur gemountet,
 * wenn der Reiter aktiv ist). Hinter Flag `modul_standard`.
 */

// Felder sind aktuell read-only. `hover:border-zinc-600` deutet dezent an, dass
// hier bald inline editiert wird; `title` macht das explizit, damit kein
// Klick-Frust entsteht (kein Cursor-pointer/Stift, der „jetzt editierbar" lügt).
const SOON = 'Bearbeiten folgt';

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">{label}</label>
      <div
        title={SOON}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600"
      >
        {empty ? <span className="text-zinc-600">—</span> : value}
      </div>
    </div>
  );
}

function Area({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">{label}</label>
      <div
        title={SOON}
        className="min-h-[2.25rem] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-300 transition-colors hover:border-zinc-600"
      >
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

type Projekt = NonNullable<ReturnType<typeof useProjekt>['data']>;
function useProjekt(projektId: string) {
  return useQuery({ queryKey: ['projekt', projektId], queryFn: () => projektApi.get(projektId) });
}

/** Reiter „Übersicht" — die Kernfelder als Block-Engine (zwei Regionen). */
function ProjektUebersicht({ p }: { p: Projekt }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <DetailRegions
        left={
          <>
            <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={2}>
              <div className={grid}>
                <Field label="Projektname" value={p.name} />
                <Area label="Beschreibung" value={p.beschreibung} />
              </div>
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
  );
}

/** Reiter „Tickets" — lazy: lädt erst, wenn der Reiter aktiv (= diese Komponente gemountet) ist. */
function ProjektTicketsTab({
  projektId,
  onRowClick,
}: {
  projektId: string;
  onRowClick: (id: string) => void;
}) {
  const ticketsQuery = useQuery({
    queryKey: ['projekt-tickets', projektId],
    queryFn: () => projektApi.getTickets(projektId, { limit: 200 }),
  });
  const tickets = ticketsQuery.data?.items ?? [];
  const total = ticketsQuery.data?.total ?? tickets.length;
  return (
    <RelationListView
      loading={ticketsQuery.isLoading}
      columns={[
        { key: 'nr', label: 'Nr.' },
        { key: 'titel', label: 'Titel' },
        { key: 'status', label: 'Status' },
        { key: 'prio', label: 'Priorität' },
      ]}
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
      total={total}
      searchPlaceholder={`🔎 in ${total} Tickets suchen …`}
      onRowClick={onRowClick}
      emptyLabel="— keine Tickets im Projekt —"
    />
  );
}

export function ProjektDetailOverlay({
  projektId,
  onClose,
}: {
  projektId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const projektQuery = useProjekt(projektId);
  const p = projektQuery.data;

  const tabs: DetailTab[] = p
    ? [
        { key: 'uebersicht', label: 'Übersicht', render: () => <ProjektUebersicht p={p} /> },
        {
          key: 'objekte',
          label: 'Objekte',
          count: p.objekte.length,
          isRelation: true,
          render: () => (
            <RelationListView
              columns={[{ key: 'name', label: 'Objekt' }]}
              rows={p.objekte.map((o) => ({ id: o.id, search: o.name, cells: [o.name] }))}
              total={p.objekte.length}
              searchPlaceholder={`🔎 in ${p.objekte.length} Objekten suchen …`}
              onRowClick={(id) => navigate(`/stammdaten/objekte/${id}`)}
              emptyLabel="— keine Objekte verknüpft —"
            />
          ),
        },
        {
          key: 'tickets',
          label: 'Tickets',
          count: p.ticket_count,
          isRelation: true,
          render: () => (
            <ProjektTicketsTab
              projektId={projektId}
              onRowClick={(id) => navigate(`/tickets/${id}`)}
            />
          ),
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="panel" fixedHeight>
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
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
