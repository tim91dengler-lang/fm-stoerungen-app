import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import { anlageApi, objektApi, ticketApi } from '../../api/endpoints';
import { ObjektStrukturEditor } from './ObjektStrukturEditor';
import { ObjektBeteiligteTab } from './ObjektBeteiligteTab';
import type { AnlageRead, TicketRead } from '../../api/types';
import {
  DetailHeader,
  DetailOverlay,
  DetailTabs,
  RelationListTab,
  type DetailTab,
} from '../../core/detail';

/**
 * Objekt-(Liegenschaft-)Detail als zentriertes Overlay (Master-Layout-Standard,
 * Reiter-Modell). Übersicht inline editierbar; Verknüpfungen (Partner, Tickets,
 * Anlagen) als echte Listen-Reiter. Hinter Flag `modul_standard`.
 *
 * Der volle Objektstruktur-Baum (Häuser/Stockwerke/Einheiten) wird im Reiter
 * „Struktur" über die geteilte `ObjektStrukturEditor`-Komponente eingebettet
 * (dieselbe wie auf der Seite /stammdaten/objekte/:id).
 */

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

function ObjektUebersicht({
  o,
  onInteractionLockChange,
}: {
  o: Objekt;
  onInteractionLockChange: (locked: boolean) => void;
}) {
  // Struktur = ganzer Inhalt der Übersicht (Tim 2026-06-03). Die Objektdaten
  // (Name, Adresse, Notiz) + Historie leben jetzt als Wurzel-Knoten „Objekt" IM
  // Struktur-Editor — keine getrennten Stammdaten-/Historie-Blöcke mehr oben.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-3 pt-3">
      <ObjektStrukturEditor
        objektId={o.id}
        objektAdresseId={o.adresse_id ?? null}
        onInteractionLockChange={onInteractionLockChange}
      />
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
  // Editor meldet offene Sub-Modals → ESC/Backdrop dürfen das Overlay dann
  // nicht schließen (sonst bliebe ein Editor-Modal verwaist offen).
  const [strukturLocked, setStrukturLocked] = useState(false);

  const tabs: DetailTab[] = o
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => (
            <ObjektUebersicht o={o} onInteractionLockChange={setStrukturLocked} />
          ),
        },
        {
          key: 'beteiligte',
          label: 'Beteiligte',
          isRelation: true,
          render: () => (
            <ObjektBeteiligteTab
              objektId={objektId}
              objektName={o.name}
              onPartner={(pid) => navigate(`/stammdaten/partner/${pid}`)}
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
      ]
    : [];

  return (
    <DetailOverlay
      open
      onClose={onClose}
      width="page"
      fixedHeight
      closeLocked={strukturLocked}
    >
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
