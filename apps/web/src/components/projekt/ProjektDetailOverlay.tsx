import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { auswahllistenApi, projektApi, userApi } from '../../api/endpoints';
import type { ProjektUpdate } from '../../api/types';
import { aktiveWerte } from '../../lib/aktiveWerte';
import {
  DetailBlock,
  DetailHeader,
  DetailOverlay,
  DetailRegions,
  DetailTabs,
  InlineEditDate,
  InlineEditSelect,
  InlineEditText,
  RelationListView,
  type DetailTab,
  type InlineSelectOption,
} from '../../core/detail';

/**
 * Referenz-Modul (Master-Layout-Standard, Reiter-Modell ab 2026-06-02): Projekt-
 * Detail als zentriertes Overlay über der Liste. Top-Navigation = Reiter
 * (`DetailTabs`): „Übersicht" (Felder, inline editierbar) + Verknüpfungs-Reiter
 * „Objekte"/„Tickets" mit voller Liste + Suche **inline** (kein gestapeltes
 * Fenster). Felder speichern **pro Feld** (Klick → ändern → Enter/Wegklicken
 * speichert, Esc bricht ab). Tickets werden **lazy** geladen. Hinter Flag
 * `modul_standard`.
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

/** Reiter „Übersicht" — Kernfelder als Block-Engine, inline editierbar (Auto-Save pro Feld). */
function ProjektUebersicht({ p }: { p: Projekt }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: ProjektUpdate) => projektApi.update(p.id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['projekt', p.id], updated); // sofortige, flicker-freie Aktualisierung
      qc.invalidateQueries({ queryKey: ['projekte'] }); // Projekt-Listenansicht
      // Tickets betten Projektname/-status ein → bei Änderung auffrischen.
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket'] });
    },
  });
  const commit = (patch: ProjektUpdate) => mutation.mutateAsync(patch).then(() => undefined);

  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });
  const { data: users } = useQuery({
    queryKey: ['users-for-projekt'],
    queryFn: () => userApi.list({ limit: 200 }),
  });
  const toOptions = (werte: { key: string; label: string }[]) =>
    werte.map((w) => ({ value: w.key, label: w.label }));
  const projekttypOptions = toOptions(
    aktiveWerte(auswahllisten?.find((l) => l.key === 'projekttyp')?.werte, p.projekttyp.key),
  );
  const statusOptions = toOptions(
    aktiveWerte(auswahllisten?.find((l) => l.key === 'projektstatus')?.werte, p.status.key),
  );
  const userOptions: InlineSelectOption[] = [
    { value: '', label: '— keiner —' },
    ...(users?.items ?? []).map((u) => ({ value: u.id, label: u.full_name })),
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <DetailRegions
        left={
          <>
            <DetailBlock title="Stammdaten" blockKey="stammdaten" defaultOpen count={2}>
              <div className={grid}>
                <InlineEditText
                  label="Projektname"
                  value={p.name}
                  required
                  onCommit={(v) => commit({ name: v ?? '' })}
                />
                <div className="sm:col-span-2">
                  <InlineEditText
                    label="Beschreibung"
                    value={p.beschreibung}
                    multiline
                    onCommit={(v) => commit({ beschreibung: v })}
                  />
                </div>
              </div>
            </DetailBlock>
            <DetailBlock title="Notizen" blockKey="notizen" count={1}>
              <div className={grid}>
                <div className="sm:col-span-2">
                  <InlineEditText
                    label="Notizen"
                    value={p.notizen}
                    multiline
                    onCommit={(v) => commit({ notizen: v })}
                  />
                </div>
              </div>
            </DetailBlock>
          </>
        }
        right={
          <>
            <DetailBlock title="Klassifizierung" blockKey="klassifizierung" defaultOpen count={2}>
              <div className={grid}>
                <InlineEditSelect
                  label="Projekttyp"
                  value={p.projekttyp.key}
                  display={<Badge label={p.projekttyp.label} />}
                  options={projekttypOptions}
                  onCommit={(v) => commit({ projekttyp_slug: v })}
                />
                <InlineEditSelect
                  label="Status"
                  value={p.status.key}
                  display={<Badge label={p.status.label} />}
                  options={statusOptions}
                  onCommit={(v) => commit({ status_slug: v })}
                />
              </div>
            </DetailBlock>
            <DetailBlock title="Verantwortung & Termine" blockKey="termine" defaultOpen count={3}>
              <div className={grid}>
                <InlineEditSelect
                  label="Verantwortlich"
                  value={p.verantwortlich?.id ?? ''}
                  display={
                    p.verantwortlich?.full_name ?? <span className="text-zinc-600">— keiner —</span>
                  }
                  options={userOptions}
                  onCommit={(v) => commit({ verantwortlich_user_id: v || null })}
                />
                <InlineEditDate
                  label="Start am"
                  value={p.start_am}
                  onCommit={(v) => commit({ start_am: v })}
                />
                <InlineEditDate
                  label="Ende am"
                  value={p.ende_am}
                  onCommit={(v) => commit({ ende_am: v })}
                />
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
