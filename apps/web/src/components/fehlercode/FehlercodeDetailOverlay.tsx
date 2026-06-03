import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import {
  auswahllistenApi,
  fehlercodeApi,
  ticketApi,
  tickettypApi,
} from '../../api/endpoints';
import type {
  AuswahllistenWertRead,
  FehlercodeUpdate,
  TicketRead,
} from '../../api/types';
import { makeAnlageSearch } from '../../lib/entitySearch';
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
 * Fehlercode-Detail als zentriertes Overlay (Master-Layout-Standard, Reiter-
 * Modell). Übersicht inline editierbar. Hinter Flag `modul_standard`. Reiter
 * „Verwendung in Tickets" listet Tickets mit diesem Fehlercode (Filter
 * `fehlercode_id`); die Übersicht zeigt zusätzlich die `nutzung`-Anzahl.
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

type Fehlercode = NonNullable<ReturnType<typeof useFehlercode>['data']>;
function useFehlercode(fehlercodeId: string) {
  return useQuery({
    queryKey: ['fehlercode', fehlercodeId],
    queryFn: () => fehlercodeApi.get(fehlercodeId),
  });
}

function FehlercodeTicketsTab({
  fehlercodeId,
  onRow,
}: {
  fehlercodeId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['fehlercode-tickets', fehlercodeId],
    queryFn: () => ticketApi.list({ fehlercode_id: fehlercodeId, limit: 200 }),
  });
  const rows = q.data?.items ?? [];
  return (
    <RelationListTab<TicketRead>
      viewKey="fehlercode-tickets"
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

function FehlercodeUebersicht({ f }: { f: Fehlercode }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: FehlercodeUpdate) => fehlercodeApi.update(f.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['fehlercode', f.id], updated);
      qc.invalidateQueries({ queryKey: ['fehlercodes'] });
    },
  });
  const commit = (patch: FehlercodeUpdate) =>
    mutation.mutateAsync(patch).then(() => undefined);

  const { data: listen } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });
  const { data: tickettypen } = useQuery({
    queryKey: ['tickettypen'],
    queryFn: () => tickettypApi.list(),
  });
  const anlageFetcher = useMemo(() => makeAnlageSearch(), []);
  const kategorieWerte = listen?.find((l) => l.key === 'ticket_kategorie')?.werte;
  const prioWerte = listen?.find((l) => l.key === 'ticket_prioritaet')?.werte;
  const tickettypOptions = [
    { value: '', label: '— keiner —' },
    ...(tickettypen ?? []).map((t) => ({ value: t.id, label: t.label })),
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto w-full max-w-5xl">
        <DetailRegions
          left={
            <>
              <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={4}>
                <div className={grid}>
                  <InlineEditText
                    label="Code"
                    value={f.code}
                    required
                    onCommit={(v) => commit({ code: v ?? '' })}
                  />
                  <InlineEditText
                    label="Titel"
                    value={f.titel}
                    required
                    onCommit={(v) => commit({ titel: v ?? '' })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Beschreibung"
                      value={f.beschreibung}
                      multiline
                      onCommit={(v) => commit({ beschreibung: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
              <DetailBlock
                title="Lösung (nur Fachpersonal)"
                blockKey="loesung"
                defaultOpen
                count={1}
              >
                <div className={grid}>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Lösungshinweis"
                      value={f.loesung}
                      multiline
                      onCommit={(v) => commit({ loesung: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
            </>
          }
          right={
            <>
              <DetailBlock
                title="Klassifizierung & Vorbelegung"
                blockKey="klass"
                defaultOpen
                count={4}
              >
                <div className={grid}>
                  <InlineEditSelect
                    label="Kategorie"
                    value={f.kategorie_wert_id ?? ''}
                    options={selectOptions(kategorieWerte, f.kategorie_wert_id)}
                    queryKey="fc-kategorie"
                    onCommit={(v) => commit({ kategorie_wert_id: v || null })}
                  />
                  <InlineEditSelect
                    label="Std-Priorität"
                    value={f.prio_default_wert_id ?? ''}
                    options={selectOptions(prioWerte, f.prio_default_wert_id)}
                    queryKey="fc-prio"
                    onCommit={(v) => commit({ prio_default_wert_id: v || null })}
                  />
                  <InlineEditSelect
                    label="Std-Tickettyp"
                    value={f.tickettyp_default_id ?? ''}
                    options={tickettypOptions}
                    queryKey="fc-tickettyp"
                    onCommit={(v) => commit({ tickettyp_default_id: v || null })}
                  />
                  <InlineEditEntity
                    label="Anlage"
                    value={f.anlage_id}
                    displayLabel={f.anlage?.bezeichnung ?? null}
                    fetcher={anlageFetcher}
                    queryKey="fc-anlage"
                    placeholder="Anlage suchen …"
                    onCommit={(v) => commit({ anlage_id: v })}
                  />
                </div>
              </DetailBlock>
              <DetailBlock title="Herkunft & Status" blockKey="status" count={3}>
                <div className={grid}>
                  <InlineEditText
                    label="Quelle"
                    value={f.quelle}
                    onCommit={(v) => commit({ quelle: v })}
                  />
                  <Field label="Status" value={f.aktiv ? 'Aktiv' : 'Inaktiv'} />
                  <Field label="Verwendung in Tickets" value={f.nutzung_count} />
                </div>
              </DetailBlock>
              <DetailBlock title="Historie" blockKey="historie" count={3}>
                <div className={grid}>
                  <Field label="Angelegt am" value={fmtDate(f.created_at)} />
                  <Field label="Zuletzt geändert am" value={fmtDate(f.updated_at)} />
                  <Field label="Interne ID" value={f.id} />
                </div>
              </DetailBlock>
            </>
          }
        />
      </div>
    </div>
  );
}

export function FehlercodeDetailOverlay({
  fehlercodeId,
  onClose,
}: {
  fehlercodeId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const fehlercodeQuery = useFehlercode(fehlercodeId);
  const f = fehlercodeQuery.data;

  const tabs: DetailTab[] = f
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => <FehlercodeUebersicht f={f} />,
        },
        {
          key: 'tickets',
          label: 'Verwendung in Tickets',
          isRelation: true,
          render: () => (
            <FehlercodeTicketsTab
              fehlercodeId={fehlercodeId}
              onRow={(id) => navigate(`/tickets/${id}`)}
            />
          ),
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="page" fixedHeight>
      {fehlercodeQuery.isLoading || !f ? (
        <div className="p-8 text-sm text-zinc-500">
          {fehlercodeQuery.isError
            ? 'Fehlercode konnte nicht geladen werden.'
            : 'Lade Fehlercode …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={f.code}
            subtitle={f.titel}
            badges={f.aktiv ? [] : [{ label: 'inaktiv' }]}
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
