import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import { anlageApi, objektApi, ticketApi } from '../../api/endpoints';
import type {
  AnlageRead,
  ObjektPartnerLinkRead,
  ObjektUpdate,
  TicketRead,
} from '../../api/types';
import { searchAdressen } from '../../lib/entitySearch';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  InlineEditEntity,
  InlineEditText,
  RelationListTab,
  type DetailTab,
} from '../../core/detail';

/**
 * Objekt-(Liegenschaft-)Detail als zentriertes Overlay (Master-Layout-Standard,
 * Reiter-Modell). Übersicht inline editierbar; Verknüpfungen (Partner, Tickets,
 * Anlagen) als echte Listen-Reiter. Hinter Flag `modul_standard`.
 *
 * Der volle Objektstruktur-Baum (Häuser/Stockwerke/Einheiten) bleibt vorerst im
 * bestehenden Struktur-Editor (Reiter „Struktur" verlinkt dorthin) — Folgeschritt.
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
const adresseLabel = (
  a: { strasse: string; plz: string; ort: string } | null | undefined,
) => (a ? `${a.strasse}, ${a.plz} ${a.ort}` : null);

type Objekt = NonNullable<ReturnType<typeof useObjekt>['data']>;
function useObjekt(objektId: string) {
  return useQuery({
    queryKey: ['objekt', objektId],
    queryFn: () => objektApi.get(objektId),
  });
}

// --- Relations-Spalten -----------------------------------------------------

const partnerColumns: ColumnDef<ObjektPartnerLinkRead>[] = [
  { id: 'partner', accessorKey: 'partner_name', header: 'Partner' },
  { id: 'rolle', accessorKey: 'rolle', header: 'Rolle' },
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

const anlageColumns: ColumnDef<AnlageRead>[] = [
  { id: 'bezeichnung', accessorKey: 'bezeichnung', header: 'Anlage' },
  { id: 'kategorie', accessorFn: (a) => a.kategorie?.label ?? '—', header: 'Kategorie' },
  { id: 'aktiv', accessorFn: (a) => (a.aktiv ? 'aktiv' : 'inaktiv'), header: 'Status' },
];

// --- Lazy Relations-Reiter -------------------------------------------------

function ObjektTicketsTab({
  objektId,
  onRow,
}: {
  objektId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['objekt-tickets', objektId],
    queryFn: () => ticketApi.list({ objekt_id: objektId, limit: 200 }),
  });
  const rows = q.data?.items ?? [];
  return (
    <RelationListTab<TicketRead>
      viewKey="objekt-tickets"
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

function ObjektAnlagenTab({ objektId }: { objektId: string }) {
  const q = useQuery({
    queryKey: ['objekt-anlagen', objektId],
    queryFn: () => anlageApi.list({ objekt_id: objektId }),
  });
  const rows = q.data ?? [];
  return (
    <RelationListTab<AnlageRead>
      viewKey="objekt-anlagen"
      loading={q.isLoading}
      columns={anlageColumns}
      data={rows}
      getSearchText={(a) => `${a.bezeichnung} ${a.kategorie?.label ?? ''}`}
      searchPlaceholder="In Anlagen suchen …"
      itemLabel={{ singular: 'Anlage', plural: 'Anlagen' }}
    />
  );
}

// --- Übersicht -------------------------------------------------------------

function ObjektUebersicht({ o }: { o: Objekt }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: ObjektUpdate) => objektApi.update(o.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['objekt', o.id], updated);
      qc.invalidateQueries({ queryKey: ['objekte'] });
      qc.invalidateQueries({ queryKey: ['tickets'] }); // Tickets betten Objektname ein
    },
  });
  const commit = (patch: ObjektUpdate) =>
    mutation.mutateAsync(patch).then(() => undefined);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto w-full max-w-5xl">
        <DetailRegions
          left={
            <>
              <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={3}>
                <div className={grid}>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Name"
                      value={o.name}
                      required
                      onCommit={(v) => commit({ name: v ?? '' })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <InlineEditEntity
                      label="Adresse"
                      value={o.adresse_id}
                      displayLabel={adresseLabel(o.adresse)}
                      fetcher={searchAdressen}
                      queryKey="objekt-adresse"
                      placeholder="Adresse suchen …"
                      onCommit={(v) => commit({ adresse_id: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Notiz"
                      value={o.notiz}
                      multiline
                      onCommit={(v) => commit({ notiz: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
            </>
          }
          right={
            <>
              <DetailBlock title="Status" blockKey="status" defaultOpen count={1}>
                <div className={grid}>
                  <Field label="Status" value={o.gesperrt ? 'Deaktiviert' : 'Aktiv'} />
                </div>
              </DetailBlock>
              <DetailBlock title="Historie" blockKey="historie" count={3}>
                <div className={grid}>
                  <Field label="Angelegt am" value={fmtDate(o.created_at)} />
                  <Field label="Zuletzt geändert am" value={fmtDate(o.updated_at)} />
                  <Field label="Interne ID" value={o.id} />
                </div>
              </DetailBlock>
            </>
          }
        />
      </div>
    </div>
  );
}

export function ObjektDetailOverlay({
  objektId,
  onClose,
}: {
  objektId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const objektQuery = useObjekt(objektId);
  const o = objektQuery.data;

  const tabs: DetailTab[] = o
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => <ObjektUebersicht o={o} />,
        },
        {
          key: 'partner',
          label: 'Partner',
          count: o.partner_links.length,
          isRelation: true,
          render: () => (
            <RelationListTab<ObjektPartnerLinkRead>
              viewKey="objekt-partner"
              columns={partnerColumns}
              data={o.partner_links}
              getSearchText={(pl) => `${pl.partner_name} ${pl.rolle}`}
              onRowClick={(pl) => navigate(`/stammdaten/partner/${pl.partner_id}`)}
              searchPlaceholder="In Partnern suchen …"
              itemLabel={{ singular: 'Partner', plural: 'Partner' }}
            />
          ),
        },
        {
          key: 'tickets',
          label: 'Tickets',
          isRelation: true,
          render: () => (
            <ObjektTicketsTab
              objektId={objektId}
              onRow={(id) => navigate(`/tickets/${id}`)}
            />
          ),
        },
        {
          key: 'anlagen',
          label: 'Anlagen',
          isRelation: true,
          render: () => <ObjektAnlagenTab objektId={objektId} />,
        },
        {
          key: 'struktur',
          label: 'Struktur',
          render: () => (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <div className="mx-auto max-w-lg rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
                <p className="mb-3">
                  Häuser, Stockwerke und Einheiten werden im vollständigen Struktur-Editor
                  bearbeitet.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/stammdaten/objekte/${objektId}`)}
                  className="rounded-md border border-emerald-600/50 px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/10"
                >
                  Struktur &amp; Etagen bearbeiten →
                </button>
              </div>
            </div>
          ),
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="page" fixedHeight>
      {objektQuery.isLoading || !o ? (
        <div className="p-8 text-sm text-zinc-500">
          {objektQuery.isError ? 'Objekt konnte nicht geladen werden.' : 'Lade Objekt …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={o.name}
            subtitle={adresseLabel(o.adresse) ?? 'ohne Adresse'}
            badges={o.gesperrt ? [{ label: 'deaktiviert' }] : []}
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
