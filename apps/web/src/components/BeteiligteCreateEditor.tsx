import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Plus, Smartphone, Star, Trash2, Users2 } from 'lucide-react';
import clsx from 'clsx';
import { partnerApi } from '../api/endpoints';
import type { TicketBeteiligterWrite } from '../api/types';
import { EntitySearchSelect } from './EntitySearchSelect';
import { searchPartner } from '../lib/entitySearch';

interface RolleOption {
  key: string;
  label: string;
}

interface LocalRow {
  key: string;
  partnerId: string | null;
  partnerName: string | null;
  kontaktId: string | null;
  rolle: string | null;
  istHaupt: boolean;
}

interface Props {
  rolleOptions: RolleOption[];
  /** Emits the full beteiligte payload (only rows with a partner) whenever it changes. */
  onChange: (beteiligte: TicketBeteiligterWrite[]) => void;
}

let counter = 0;

/**
 * Beteiligte-Editor für das Anlege-Modal: lokaler Form-State (kein Server-Roundtrip),
 * beliebig viele Geschäftspartner + Ansprechpartner mit Rolle/Hauptkontakt; Kontaktdaten
 * (E-Mail/Telefon/Mobil) werden clientseitig aus Partner-/Kontakt-Stamm aufgelöst.
 */
export function BeteiligteCreateEditor({ rolleOptions, onChange }: Props) {
  const [rows, setRows] = useState<LocalRow[]>([]);

  function emit(next: LocalRow[]) {
    setRows(next);
    onChange(
      next
        .filter((r) => r.partnerId)
        .map<TicketBeteiligterWrite>((r) => ({
          partner_id: r.partnerId as string,
          partner_kontakt_id: r.kontaktId,
          rolle: r.rolle,
          ist_hauptkontakt: r.istHaupt,
        })),
    );
  }

  function addRow() {
    counter += 1;
    emit([
      ...rows,
      {
        key: `row-${counter}`,
        partnerId: null,
        partnerName: null,
        kontaktId: null,
        rolle: rolleOptions[0]?.key ?? null,
        istHaupt: rows.length === 0,
      },
    ]);
  }

  function patch(key: string, p: Partial<LocalRow>) {
    emit(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function remove(key: string) {
    emit(rows.filter((r) => r.key !== key));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-xs text-zinc-400">
        <Users2 className="h-3.5 w-3.5" /> Beteiligte
      </div>

      {rows.map((r) => (
        <CreateRow
          key={r.key}
          row={r}
          rolleOptions={rolleOptions}
          onPartner={(id, name) => patch(r.key, { partnerId: id, partnerName: name, kontaktId: null })}
          onRolle={(rolle) => patch(r.key, { rolle })}
          onKontakt={(kid) => patch(r.key, { kontaktId: kid })}
          onHaupt={(v) => patch(r.key, { istHaupt: v })}
          onRemove={() => remove(r.key)}
        />
      ))}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
      >
        <Plus className="h-3.5 w-3.5" /> Beteiligten hinzufügen
      </button>
    </div>
  );
}

const SELECT_CLASS =
  'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none';

function CreateRow({
  row,
  rolleOptions,
  onPartner,
  onRolle,
  onKontakt,
  onHaupt,
  onRemove,
}: {
  row: LocalRow;
  rolleOptions: RolleOption[];
  onPartner: (id: string | null, name: string | null) => void;
  onRolle: (v: string | null) => void;
  onKontakt: (v: string | null) => void;
  onHaupt: (v: boolean) => void;
  onRemove: () => void;
}) {
  // Kontaktdaten clientseitig auflösen (kein Server-Roundtrip beim Anlegen).
  const partnerQuery = useQuery({
    queryKey: ['partner-detail-contact', row.partnerId],
    queryFn: () => partnerApi.get(row.partnerId as string),
    enabled: !!row.partnerId,
    staleTime: 60_000,
  });
  const kontakteQuery = useQuery({
    queryKey: ['partner-kontakte', row.partnerId],
    queryFn: () => partnerApi.listKontakte(row.partnerId as string),
    enabled: !!row.partnerId,
    staleTime: 60_000,
  });
  const kontakt = kontakteQuery.data?.find((k) => k.id === row.kontaktId);
  const email = kontakt?.email || partnerQuery.data?.email || null;
  const telefon = kontakt?.telefon || partnerQuery.data?.telefon || null;
  const mobil = kontakt?.mobil || partnerQuery.data?.mobil || null;

  // Hauptkontakt vorbelegen: erster Ansprechpartner, falls noch keiner gewählt.
  useEffect(() => {
    if (row.partnerId && row.kontaktId == null && kontakteQuery.data) {
      const haupt = kontakteQuery.data.find((k) => k.ist_hauptkontakt);
      if (haupt) onKontakt(haupt.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontakteQuery.data, row.partnerId]);

  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <EntitySearchSelect
            value={row.partnerId}
            initialLabel={row.partnerName}
            onChange={(id, opt) => onPartner(id, opt?.label ?? null)}
            fetcher={searchPartner}
            queryKey="partner-create-beteiligter"
            placeholder="Geschäftspartner suchen …"
          />
        </div>
        <button
          type="button"
          onClick={() => onHaupt(!row.istHaupt)}
          className={clsx(
            'rounded p-1',
            row.istHaupt ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400',
          )}
          title={row.istHaupt ? 'Hauptkontakt' : 'Als Hauptkontakt markieren'}
          aria-label="Hauptkontakt"
        >
          <Star className="h-3.5 w-3.5" fill={row.istHaupt ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
          title="Entfernen"
          aria-label="Entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={row.rolle ?? ''}
          onChange={(e) => onRolle(e.target.value || null)}
          className={SELECT_CLASS}
          aria-label="Rolle"
        >
          <option value="">— Rolle —</option>
          {rolleOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={row.kontaktId ?? ''}
          onChange={(e) => onKontakt(e.target.value || null)}
          className={SELECT_CLASS}
          disabled={!row.partnerId}
          aria-label="Ansprechpartner"
        >
          <option value="">— Ansprechpartner —</option>
          {kontakteQuery.data?.map((k) => (
            <option key={k.id} value={k.id}>
              {[k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ansprechpartner'}
            </option>
          ))}
        </select>
      </div>

      {row.partnerId && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1 text-sky-300 hover:underline" title={email}>
              <Mail className="h-3 w-3" /> E-Mail
            </a>
          )}
          {telefon && (
            <a href={`tel:${telefon}`} className="inline-flex items-center gap-1 text-emerald-300 hover:underline" title={telefon}>
              <Phone className="h-3 w-3" /> {telefon}
            </a>
          )}
          {mobil && (
            <a href={`tel:${mobil}`} className="inline-flex items-center gap-1 text-emerald-300 hover:underline" title={mobil}>
              <Smartphone className="h-3 w-3" /> {mobil}
            </a>
          )}
          {!email && !telefon && !mobil && (
            <span className="text-[10px] text-zinc-600">keine Kontaktdaten hinterlegt</span>
          )}
        </div>
      )}
    </div>
  );
}
