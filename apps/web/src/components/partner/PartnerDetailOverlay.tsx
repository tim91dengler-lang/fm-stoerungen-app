import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import { auswahllistenApi, partnerApi } from '../../api/endpoints';
import type {
  AuswahllistenWertRead,
  PartnerAdresseRead,
  PartnerKontaktRead,
  PartnerObjektLinkRead,
  PartnerProjektLinkRead,
  PartnerTicketLinkRead,
  PartnerUpdate,
} from '../../api/types';
import { searchPartner } from '../../lib/entitySearch';
import { usePartnerTypLookup } from '../../lib/usePartnerTypLookup';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  InlineEditEntity,
  InlineEditMulti,
  InlineEditSelect,
  InlineEditText,
  RelationListTab,
  type DetailTab,
} from '../../core/detail';

/**
 * Geschäftspartner-Detail als zentriertes Overlay (Master-Layout-Standard,
 * Reiter-Modell). Übersicht inline editierbar (Auto-Save pro Feld, gestylte
 * Picker), Verknüpfungen (Kontaktpersonen, Adressen, Objekte, Projekte, Tickets)
 * als echte Listen-Reiter. Hinter Flag `modul_standard`.
 *
 * Erste Stufe: Partner-eigene Felder inline editierbar; Sub-CRUD (Kontakte/
 * Adressen anlegen/löschen) bleibt vorerst Read-Liste — Folgeschritt.
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

/** Optionen für ein nullbares Auswahllisten-Select (inkl. „— keine —"). */
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

type Partner = NonNullable<ReturnType<typeof usePartner>['data']>;
function usePartner(partnerId: string) {
  return useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => partnerApi.get(partnerId),
  });
}

// --- Relations-Spalten -----------------------------------------------------

const kontaktColumns: ColumnDef<PartnerKontaktRead>[] = [
  {
    id: 'name',
    accessorFn: (k) => [k.vorname, k.nachname].filter(Boolean).join(' ') || '—',
    header: 'Name',
  },
  { id: 'email', accessorFn: (k) => k.email ?? '—', header: 'E-Mail' },
  { id: 'telefon', accessorFn: (k) => k.telefon ?? k.mobil ?? '—', header: 'Telefon' },
  {
    id: 'haupt',
    accessorFn: (k) => (k.ist_hauptkontakt ? 'Hauptkontakt' : '—'),
    header: 'Rolle',
  },
];

const adresseColumns: ColumnDef<PartnerAdresseRead>[] = [
  {
    id: 'anschrift',
    accessorFn: (a) =>
      a.adresse ? `${a.adresse.strasse}, ${a.adresse.plz} ${a.adresse.ort}` : '—',
    header: 'Anschrift',
  },
  {
    id: 'primaer',
    accessorFn: (a) => (a.ist_primaer ? 'primär' : '—'),
    header: 'Primär',
  },
];

const objektColumns: ColumnDef<PartnerObjektLinkRead>[] = [
  { id: 'objekt', accessorKey: 'objekt_name', header: 'Objekt' },
  { id: 'rollen', accessorFn: (o) => o.rollen.join(', ') || '—', header: 'Rollen' },
  { id: 'adresse', accessorFn: (o) => o.adresse_kurz ?? '—', header: 'Adresse' },
];

const projektColumns: ColumnDef<PartnerProjektLinkRead>[] = [
  { id: 'name', accessorKey: 'name', header: 'Projekt' },
  { id: 'status', accessorKey: 'status_label', header: 'Status' },
  { id: 'typ', accessorKey: 'projekttyp_label', header: 'Typ' },
  {
    id: 'start',
    accessorFn: (p) => p.start_am,
    header: 'Start',
    cell: (c) => fmtDate(c.getValue<string | null>()),
  },
];

const ticketColumns: ColumnDef<PartnerTicketLinkRead>[] = [
  {
    id: 'nummer',
    accessorFn: (t) => t.nummer,
    header: 'Nr.',
    cell: (c) => (
      <span className="font-medium text-zinc-100">#{c.getValue<number>()}</span>
    ),
  },
  { id: 'titel', accessorKey: 'titel', header: 'Titel' },
  { id: 'status', accessorKey: 'status_label', header: 'Status' },
  { id: 'prio', accessorKey: 'prioritaet_label', header: 'Priorität' },
  { id: 'objekt', accessorFn: (t) => t.objekt_name ?? '—', header: 'Objekt' },
  {
    id: 'eroeffnet',
    accessorFn: (t) => t.eroeffnet_am,
    header: 'Eröffnet',
    cell: (c) => fmtDate(c.getValue<string>()),
  },
];

// --- Lazy Relations-Reiter (eigener Fetch nur wenn aktiv) ------------------

function PartnerObjekteTab({
  partnerId,
  onRow,
}: {
  partnerId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['partner-objekte', partnerId],
    queryFn: () => partnerApi.listObjekte(partnerId),
  });
  const rows = q.data ?? [];
  return (
    <RelationListTab<PartnerObjektLinkRead>
      viewKey="partner-objekte"
      loading={q.isLoading}
      columns={objektColumns}
      data={rows}
      getSearchText={(o) =>
        `${o.objekt_name} ${o.rollen.join(' ')} ${o.adresse_kurz ?? ''}`
      }
      onRowClick={(o) => onRow(o.objekt_id)}
      searchPlaceholder="In Objekten suchen …"
      itemLabel={{ singular: 'Objekt', plural: 'Objekte' }}
    />
  );
}

function PartnerProjekteTab({
  partnerId,
  onRow,
}: {
  partnerId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['partner-projekte', partnerId],
    queryFn: () => partnerApi.listProjekte(partnerId),
  });
  const rows = q.data ?? [];
  return (
    <RelationListTab<PartnerProjektLinkRead>
      viewKey="partner-projekte"
      loading={q.isLoading}
      columns={projektColumns}
      data={rows}
      getSearchText={(p) => `${p.name} ${p.status_label} ${p.projekttyp_label}`}
      onRowClick={(p) => onRow(p.projekt_id)}
      searchPlaceholder="In Projekten suchen …"
      itemLabel={{ singular: 'Projekt', plural: 'Projekte' }}
    />
  );
}

function PartnerTicketsTab({
  partnerId,
  onRow,
}: {
  partnerId: string;
  onRow: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ['partner-tickets', partnerId],
    queryFn: () => partnerApi.listTickets(partnerId, true),
  });
  const rows = q.data ?? [];
  return (
    <RelationListTab<PartnerTicketLinkRead>
      viewKey="partner-tickets"
      loading={q.isLoading}
      columns={ticketColumns}
      data={rows}
      getSearchText={(t) =>
        `${t.nummer} ${t.titel} ${t.status_label} ${t.objekt_name ?? ''}`
      }
      onRowClick={(t) => onRow(t.ticket_id)}
      searchPlaceholder="In Tickets suchen …"
      itemLabel={{ singular: 'Ticket', plural: 'Tickets' }}
    />
  );
}

// --- Übersicht -------------------------------------------------------------

function PartnerUebersicht({ p }: { p: Partner }) {
  const qc = useQueryClient();
  const typLookup = usePartnerTypLookup();
  const mutation = useMutation({
    mutationFn: (patch: PartnerUpdate) => partnerApi.update(p.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['partner', p.id], updated);
      qc.invalidateQueries({ queryKey: ['partner'] });
    },
  });
  // typen ist beim Update Pflicht (min []), darum immer mitschicken.
  const commit = (patch: PartnerUpdate) =>
    mutation.mutateAsync({ typen: p.typen, ...patch }).then(() => undefined);

  const { data: listen } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });
  const werte = (key: string) => listen?.find((l) => l.key === key)?.werte;
  const typOptions = typLookup.werte.map((w) => ({ value: w.id, label: w.label }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto w-full max-w-5xl">
        <DetailRegions
          left={
            <>
              <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={6}>
                <div className={grid}>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Name / Firma"
                      value={p.name}
                      required
                      onCommit={(v) => commit({ name: v ?? '' })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <InlineEditMulti
                      label="Typen"
                      value={p.typen}
                      options={typOptions}
                      onCommit={(next) => commit({ typen: next })}
                    />
                  </div>
                  <InlineEditSelect
                    label="Rechtsform"
                    value={p.rechtsform_id ?? ''}
                    options={selectOptions(werte('rechtsform'), p.rechtsform_id)}
                    queryKey="partner-rechtsform"
                    onCommit={(v) => commit({ rechtsform_id: v || null })}
                  />
                  <InlineEditSelect
                    label="Branche"
                    value={p.branche_id ?? ''}
                    options={selectOptions(werte('branche'), p.branche_id)}
                    queryKey="partner-branche"
                    onCommit={(v) => commit({ branche_id: v || null })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditEntity
                      label="Übergeordneter Partner"
                      value={p.parent_partner_id}
                      displayLabel={null}
                      fetcher={searchPartner}
                      queryKey="partner-parent"
                      placeholder="Partner suchen …"
                      onCommit={(v) => commit({ parent_partner_id: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Notiz"
                      value={p.notiz}
                      multiline
                      onCommit={(v) => commit({ notiz: v })}
                    />
                  </div>
                </div>
              </DetailBlock>

              <DetailBlock title="Personenangaben" blockKey="person" count={4}>
                <div className={grid}>
                  <InlineEditSelect
                    label="Anrede"
                    value={p.anrede_id ?? ''}
                    options={selectOptions(werte('anrede'), p.anrede_id)}
                    queryKey="partner-anrede"
                    onCommit={(v) => commit({ anrede_id: v || null })}
                  />
                  <InlineEditText
                    label="Titel"
                    value={p.titel}
                    onCommit={(v) => commit({ titel: v })}
                  />
                  <InlineEditText
                    label="Vorname"
                    value={p.vorname}
                    onCommit={(v) => commit({ vorname: v })}
                  />
                  <InlineEditText
                    label="Nachname"
                    value={p.nachname}
                    onCommit={(v) => commit({ nachname: v })}
                  />
                </div>
              </DetailBlock>

              <DetailBlock
                title="Kontaktdaten"
                blockKey="kontaktdaten"
                defaultOpen
                count={5}
              >
                <div className={grid}>
                  <InlineEditText
                    label="E-Mail"
                    value={p.email}
                    onCommit={(v) => commit({ email: v })}
                  />
                  <InlineEditText
                    label="Telefon"
                    value={p.telefon}
                    onCommit={(v) => commit({ telefon: v })}
                  />
                  <InlineEditText
                    label="Mobil"
                    value={p.mobil}
                    onCommit={(v) => commit({ mobil: v })}
                  />
                  <InlineEditText
                    label="Fax"
                    value={p.telefax}
                    onCommit={(v) => commit({ telefax: v })}
                  />
                  <div className="sm:col-span-2">
                    <InlineEditText
                      label="Website"
                      value={p.website}
                      onCommit={(v) => commit({ website: v })}
                    />
                  </div>
                </div>
              </DetailBlock>
            </>
          }
          right={
            <>
              <DetailBlock
                title="Status & Hierarchie"
                blockKey="status"
                defaultOpen
                count={2}
              >
                <div className={grid}>
                  <Field label="Partner-Nr" value={p.partner_nummer} />
                  <Field label="Status" value={p.gesperrt ? 'Gesperrt' : 'Aktiv'} />
                </div>
              </DetailBlock>
              <DetailBlock title="Identifikatoren" blockKey="ident" count={3}>
                <div className={grid}>
                  <InlineEditText
                    label="USt-IdNr"
                    value={p.ust_id_nr}
                    onCommit={(v) => commit({ ust_id_nr: v })}
                  />
                  <InlineEditText
                    label="Steuer-Nr"
                    value={p.steuer_nr}
                    onCommit={(v) => commit({ steuer_nr: v })}
                  />
                  <InlineEditText
                    label="HRB"
                    value={p.hrb}
                    onCommit={(v) => commit({ hrb: v })}
                  />
                </div>
              </DetailBlock>
              <DetailBlock title="Historie" blockKey="historie" count={3}>
                <div className={grid}>
                  <Field label="Erstellt am" value={fmtDate(p.created_at)} />
                  <Field label="Zuletzt geändert am" value={fmtDate(p.updated_at)} />
                  <Field label="Interne ID" value={p.id} />
                </div>
              </DetailBlock>
            </>
          }
        />
      </div>
    </div>
  );
}

export function PartnerDetailOverlay({
  partnerId,
  onClose,
}: {
  partnerId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const partnerQuery = usePartner(partnerId);
  const p = partnerQuery.data;

  const tabs: DetailTab[] = p
    ? [
        {
          key: 'uebersicht',
          label: 'Übersicht',
          render: () => <PartnerUebersicht p={p} />,
        },
        {
          key: 'kontakte',
          label: 'Kontaktpersonen',
          count: p.kontakte.length,
          isRelation: true,
          render: () => (
            <RelationListTab<PartnerKontaktRead>
              viewKey="partner-kontakte"
              columns={kontaktColumns}
              data={p.kontakte}
              getSearchText={(k) =>
                `${k.vorname ?? ''} ${k.nachname ?? ''} ${k.email ?? ''}`
              }
              searchPlaceholder="In Kontaktpersonen suchen …"
              itemLabel={{ singular: 'Kontakt', plural: 'Kontaktpersonen' }}
            />
          ),
        },
        {
          key: 'adressen',
          label: 'Adressen',
          count: p.adress_links.length,
          isRelation: true,
          render: () => (
            <RelationListTab<PartnerAdresseRead>
              viewKey="partner-adressen"
              columns={adresseColumns}
              data={p.adress_links}
              getSearchText={(a) =>
                a.adresse ? `${a.adresse.strasse} ${a.adresse.plz} ${a.adresse.ort}` : ''
              }
              searchPlaceholder="In Adressen suchen …"
              itemLabel={{ singular: 'Adresse', plural: 'Adressen' }}
            />
          ),
        },
        {
          key: 'objekte',
          label: 'Objekte',
          isRelation: true,
          render: () => (
            <PartnerObjekteTab
              partnerId={partnerId}
              onRow={(id) => navigate(`/stammdaten/objekte/${id}`)}
            />
          ),
        },
        {
          key: 'projekte',
          label: 'Projekte',
          isRelation: true,
          render: () => (
            <PartnerProjekteTab
              partnerId={partnerId}
              onRow={(id) => navigate(`/projekte/${id}`)}
            />
          ),
        },
        {
          key: 'tickets',
          label: 'Tickets',
          isRelation: true,
          render: () => (
            <PartnerTicketsTab
              partnerId={partnerId}
              onRow={(id) => navigate(`/tickets/${id}`)}
            />
          ),
        },
      ]
    : [];

  return (
    <DetailOverlay open onClose={onClose} width="page" fixedHeight>
      {partnerQuery.isLoading || !p ? (
        <div className="p-8 text-sm text-zinc-500">
          {partnerQuery.isError
            ? 'Partner konnte nicht geladen werden.'
            : 'Lade Partner …'}
        </div>
      ) : (
        <>
          <DetailHeader
            title={p.name}
            subtitle={`Partner-Nr ${p.partner_nummer}`}
            badges={p.gesperrt ? [{ label: 'gesperrt' }] : []}
            onClose={onClose}
          />
          <DetailTabs tabs={tabs} />
        </>
      )}
    </DetailOverlay>
  );
}
