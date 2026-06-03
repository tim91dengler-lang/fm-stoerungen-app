import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import {
  anlageApi,
  auswahllistenApi,
  fehlercodeApi,
  ticketApi,
} from '../../api/endpoints';
import type {
  AnlageUpdate,
  AuswahllistenWertRead,
  FehlercodeRead,
  TicketRead,
} from '../../api/types';
import { searchObjekte } from '../../lib/entitySearch';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  InlineEditEntity,
  InlineEditSelect,
  InlineEditText,
  RelationListTab,
  type DetailTab,
} from '../../core/detail';

/**
 * Anlage-Detail als zentriertes Overlay (Master-Layout-Standard, Reiter-Modell).
 * Übersicht inline editierbar; Verknüpfung „Fehlercodes" als echte Liste. Hinter
 * Flag `modul_standard`. Icon/Stockwerk/Aktiv-Toggle: Folgeschritt.
 */

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300">
        {empty ? <span className="text-zinc-600">—</span> : value}
      </div>
    </div>
  );
}

const grid = 'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2';
const fmtDate = (s?: string | null) =>
  s ? s.slice(0, 10).split('-').reverse().join('.') : null;

function selectOptions(
  werte: AuswahllistenWertRead[] | undefined,
  currentId: string | null,
) {
  return [
    { value: '', label: '— keine —' },
    ...(werte ?? [])
      .filter((w) => w.ist_aktiv || w.id === currentId)
      .map((w) => ({ value: w.id, label: w.label })),
  ];
}

const fehlercodeColumns: ColumnDef<FehlercodeRead>[] = [
  { id: 'code', accessorKey: 'code', header: 'Code' },
  { id: 'titel', accessorKey: 'titel', header: 'Titel' },
  { id: 'kategorie', accessorFn: (f) => f.kategorie?.label ?? '—', header: 'Kategorie' },
  { id: 'aktiv', accessorFn: (f) => (f.aktiv ? 'aktiv' : 'inaktiv'), header: 'Status' },
];

const ticketColumns: ColumnDef<TicketRead>[] = [
  {
    id: 'nummer',
    accessorFn: (t) => t.nummer,
    header: 'Nr.',
    cell: (c) => (
      <span className="font-medium text-zinc-100">#{c.getValue<number>()}</span>
    ),
  },
  { id: 'titel', accessorKey: 'titel', header: 'Titel' },
  { id: 'status', accessorFn: (t) => t.status.label, header: 'Status' },
  { id: 'prioritaet', accessorFn: (t) => t.prioritaet.label, header: 'Priorität' },
  {
    id: 'eroeffnet_am',
    accessorFn: (t) => t.eroeffnet_am,
    header: 'Eröffnet',
    cell: (c) => fmtDate(c.getValue<string>()),
  },
];

type Anlage = NonNullable<ReturnType<typeof useAnlage>['data']>;
function useAnlage(anlageId: string) {
  return useQuery({
    queryKey: ['anlage', anlageId],
    queryFn: () => anlageApi.get(anlageId),
  });
}

function AnlageFehlercodesTab({
  anlageId,
  onRow,
}: {
  anlageId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['anlage-fehlercodes', anlageId],
    queryFn: () => fehlercodeApi.list({ anlage_id: anlageId }),
  });
  const rows = q.data ?? [];
  return (
    <RelationListTab<FehlercodeRead>
      viewKey="anlage-fehlercodes"
      loading={q.isLoading}
      columns={fehlercodeColumns}
      data={rows}
      getSearchText={(f) => `${f.code} ${f.titel} ${f.kategorie?.label ?? ''}`}
      onRowClick={(f) => onRow(f.id)}
      searchPlaceholder="In Fehlercodes suchen …"
      itemLabel={{ singular: 'Fehlercode', plural: 'Fehlercodes' }}
    />
  );
}

function AnlageTicketsTab({
  anlageId,
  onRow,
}: {
  anlageId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['anlage-tickets', anlageId],
    queryFn: () => ticketApi.list({ anlage_id: anlageId, limit: 200 }),
  });
  const rows = q.data?.items ?? [];
  return (
    <RelationListTab<TicketRead>
      viewKey="anlage-tickets"
      loading={q.isLoading}
      columns={ticketColumns}
      data={rows}
      total={q.data?.total}
      getSearchText={(t) => `${t.nummer} ${t.titel} ${t.status.label}`}
      onRowClick={(t) => onRow(t.id)}
      searchPlaceholder="In Tickets suchen …"
      itemLabel={{ singular: 'Ticket', plural: 'Tickets' }}
    />
  );
}

function AnlageUebersicht({ a }: { a: Anlage }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: AnlageUpdate) => anlageApi.update(a.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['anlage', a.id], updated);
      qc.invalidateQueries({ queryKey: ['anlagen'] });
    },
  });
  const commit = (patch: AnlageUpdate) =>
    mutation.mutateAsync(patch).then(() => undefined);

  const { data: listen } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });
  const kategorieWerte = listen?.find((l) => l.key === 'ticket_kategorie')?.werte;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto w-full max-w-5xl">
        <DetailRegions
          left={
            <>
              <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={4}>
                <div className={grid}>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Bezeichnung"
                      value={a.bezeichnung}
                      required
                      onCommit={(v) => commit({ bezeichnung: v ?? '' })}
                    />
                  </div>
                  <InlineEditSelect
                    label="Kategorie"
                    value={a.kategorie_wert_id ?? ''}
                    options={selectOptions(kategorieWerte, a.kategorie_wert_id)}
                    queryKey="anlage-kategorie"
                    onCommit={(v) => commit({ kategorie_wert_id: v || null })}
                  />
                  <InlineEditEntity
                    label="Objekt"
                    value={a.objekt_id}
                    displayLabel={a.objekt?.name ?? null}
                    fetcher={searchObjekte}
                    queryKey="anlage-objekt"
                    placeholder="Objekt suchen …"
                    onCommit={(v) => commit({ objekt_id: v })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Beschreibung"
                      value={a.beschreibung}
                      multiline
                      onCommit={(v) => commit({ beschreibung: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
            </>
          }
          right={
            <>
              <DetailBlock title="Status" blockKey="status" defaultOpen count={2}>
                <div className={grid}>
                  <Field label="Status" value={a.aktiv ? 'Aktiv' : 'Inaktiv'} />
                  <Field label="Stockwerk" value={a.stockwerk?.bezeichnung} />
                </div>
              </DetailBlock>
              <DetailBlock title="Historie" blockKey="historie" count={3}>
                <div className={grid}>
                  <Field label="Angelegt am" value={fmtDate(a.created_at)} />
                  <Field label="Zuletzt geändert am" value={fmtDate(a.updated_at)} />
                  <Field label="Interne ID" value={a.id} />
                </div>
              </DetailBlock>
            </>
          }
        />
      </div>
    </div>
  );
}

export function AnlageDetailOverlay({
  anlageId,
  onClose,
}: {
  anlageId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const anlageQuery = useAnlage(anlageId);
  const a = anlageQuery.data;

  const tabs: DetailTab[] = a
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => <AnlageUebersicht a={a} />,
        },
        {
          key: 'fehlercodes',
          label: 'Fehlercodes',
          isRelation: true,
          render: () => (
            <AnlageFehlercodesTab
              anlageId={anlageId}
              onRow={(id) => navigate(`/stammdaten/fehlercodes?code=${id}`)}
            />
          ),
        },
        {
          key: 'tickets',
          label: 'Tickets',
          isRelation: true,
          render: () => (
            <AnlageTicketsTab
              anlageId={anlageId}
              onRow={(id) => navigate(`/tickets/${id}`)}
            />
          ),
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="page" fixedHeight>
      {anlageQuery.isLoading || !a ? (
        <div className="p-8 text-sm text-zinc-500">
          {anlageQuery.isError ? 'Anlage konnte nicht geladen werden.' : 'Lade Anlage …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={a.bezeichnung}
            subtitle={a.objekt ? a.objekt.name : 'ohne Objekt'}
            badges={a.aktiv ? [] : [{ label: 'inaktiv' }]}
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
