import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Plus, Smartphone, Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { partnerApi } from '../api/endpoints';
import type {
  TicketBeteiligterRead,
  TicketBeteiligterWrite,
} from '../api/types';
import { EntitySearchSelect } from './EntitySearchSelect';
import { searchPartner } from '../lib/entitySearch';

interface RolleOption {
  key: string;
  label: string;
}

interface BeteiligteBlockProps {
  beteiligte: TicketBeteiligterRead[];
  rolleOptions: RolleOption[];
  /** Receives the full new list (Voll-Replace) whenever something changes. */
  onChange: (next: TicketBeteiligterWrite[]) => void;
}

/** Eine noch nicht gespeicherte Zeile (Partner noch nicht gewählt). */
interface DraftRow {
  key: string;
  partnerId: string | null;
  partnerName: string | null;
  kontaktId: string | null;
  rolle: string | null;
  istHaupt: boolean;
}

function toWrite(b: TicketBeteiligterRead): TicketBeteiligterWrite {
  return {
    id: b.id,
    partner_id: b.partner.id,
    partner_kontakt_id: b.kontakt?.id ?? null,
    rolle: b.rolle?.key ?? null,
    ist_hauptkontakt: b.ist_hauptkontakt,
    reihenfolge: b.reihenfolge,
  };
}

let draftCounter = 0;

/**
 * Beteiligte am Ticket: beliebig viele Geschäftspartner + optional Ansprechpartner
 * mit Rolle, Hauptkontakt und Direkt-Kontakt (mailto/tel). Voll-Replace-Liste:
 * jede Änderung emittiert die komplette neue Liste.
 */
export function BeteiligteBlock({
  beteiligte,
  rolleOptions,
  onChange,
}: BeteiligteBlockProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const savedWrites = useMemo(() => beteiligte.map(toWrite), [beteiligte]);

  function emitSaved(next: TicketBeteiligterWrite[]) {
    // Offene Entwürfe (mit Partner) anhängen, damit sie nicht verloren gehen.
    const draftWrites = drafts
      .filter((d) => d.partnerId)
      .map<TicketBeteiligterWrite>((d) => ({
        partner_id: d.partnerId as string,
        partner_kontakt_id: d.kontaktId,
        rolle: d.rolle,
        ist_hauptkontakt: d.istHaupt,
      }));
    onChange([...next, ...draftWrites]);
  }

  function patchSaved(id: string, patch: Partial<TicketBeteiligterWrite>) {
    emitSaved(savedWrites.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  function removeSaved(id: string) {
    emitSaved(savedWrites.filter((w) => w.id !== id));
  }

  function addDraft() {
    draftCounter += 1;
    setDrafts((d) => [
      ...d,
      {
        key: `draft-${draftCounter}`,
        partnerId: null,
        partnerName: null,
        kontaktId: null,
        rolle: rolleOptions[0]?.key ?? null,
        istHaupt: false,
      },
    ]);
  }

  function updateDraft(key: string, patch: Partial<DraftRow>) {
    setDrafts((d) => d.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeDraft(key: string) {
    setDrafts((d) => d.filter((row) => row.key !== key));
  }

  /** Entwurf mit gewähltem Partner → an die Server-Liste committen. */
  function commitDraft(key: string, partnerId: string) {
    const draft = drafts.find((d) => d.key === key);
    if (!draft) return;
    onChange([
      ...savedWrites,
      ...drafts
        .filter((d) => d.partnerId && d.key !== key)
        .map<TicketBeteiligterWrite>((d) => ({
          partner_id: d.partnerId as string,
          partner_kontakt_id: d.kontaktId,
          rolle: d.rolle,
          ist_hauptkontakt: d.istHaupt,
        })),
      {
        partner_id: partnerId,
        partner_kontakt_id: draft.kontaktId,
        rolle: draft.rolle,
        ist_hauptkontakt: draft.istHaupt,
      },
    ]);
    removeDraft(key);
  }

  return (
    <div className="space-y-2">
      {beteiligte.length === 0 && drafts.length === 0 && (
        <p className="text-xs text-zinc-500">Noch keine Beteiligten zugeordnet.</p>
      )}

      {beteiligte.map((b) => (
        <SavedBeteiligterRow
          key={b.id}
          b={b}
          rolleOptions={rolleOptions}
          onRolle={(rolle) => patchSaved(b.id, { rolle })}
          onKontakt={(kid) => patchSaved(b.id, { partner_kontakt_id: kid })}
          onHaupt={(v) => patchSaved(b.id, { ist_hauptkontakt: v })}
          onRemove={() => removeSaved(b.id)}
        />
      ))}

      {drafts.map((d) => (
        <DraftBeteiligterRow
          key={d.key}
          draft={d}
          rolleOptions={rolleOptions}
          onPartner={(pid) => {
            updateDraft(d.key, { partnerId: pid });
            if (pid) commitDraft(d.key, pid);
          }}
          onRolle={(rolle) => updateDraft(d.key, { rolle })}
          onRemove={() => removeDraft(d.key)}
        />
      ))}

      <button
        type="button"
        onClick={addDraft}
        className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
      >
        <Plus className="h-3.5 w-3.5" /> Beteiligten hinzufügen
      </button>
    </div>
  );
}

// ============================================================================

const ROW_CLASS =
  'rounded-md border border-zinc-800 bg-zinc-950/40 p-2 space-y-2';
const SELECT_CLASS =
  'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none';

function RolleSelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: RolleOption[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={SELECT_CLASS}
      aria-label="Rolle"
    >
      <option value="">— Rolle —</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ContactActions({
  email,
  telefon,
  mobil,
}: {
  email: string | null;
  telefon: string | null;
  mobil: string | null;
}) {
  if (!email && !telefon && !mobil) {
    return <span className="text-[10px] text-zinc-600">keine Kontaktdaten</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1 text-sky-300 hover:underline"
          title={email}
        >
          <Mail className="h-3 w-3" /> E-Mail
        </a>
      )}
      {telefon && (
        <a
          href={`tel:${telefon}`}
          className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
          title={telefon}
        >
          <Phone className="h-3 w-3" /> {telefon}
        </a>
      )}
      {mobil && (
        <a
          href={`tel:${mobil}`}
          className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
          title={mobil}
        >
          <Smartphone className="h-3 w-3" /> {mobil}
        </a>
      )}
    </div>
  );
}

function SavedBeteiligterRow({
  b,
  rolleOptions,
  onRolle,
  onKontakt,
  onHaupt,
  onRemove,
}: {
  b: TicketBeteiligterRead;
  rolleOptions: RolleOption[];
  onRolle: (v: string | null) => void;
  onKontakt: (v: string | null) => void;
  onHaupt: (v: boolean) => void;
  onRemove: () => void;
}) {
  const kontakteQuery = useQuery({
    queryKey: ['partner-kontakte', b.partner.id],
    queryFn: () => partnerApi.listKontakte(b.partner.id),
    staleTime: 60_000,
  });

  return (
    <div className={ROW_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-100">
          {b.partner.name}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onHaupt(!b.ist_hauptkontakt)}
            className={clsx(
              'rounded p-1',
              b.ist_hauptkontakt
                ? 'text-amber-400'
                : 'text-zinc-600 hover:text-zinc-400',
            )}
            title={b.ist_hauptkontakt ? 'Hauptkontakt' : 'Als Hauptkontakt markieren'}
            aria-label="Hauptkontakt"
          >
            <Star
              className="h-3.5 w-3.5"
              fill={b.ist_hauptkontakt ? 'currentColor' : 'none'}
            />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            title="Beteiligten entfernen"
            aria-label="Entfernen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RolleSelect value={b.rolle?.key ?? null} options={rolleOptions} onChange={onRolle} />
        <select
          value={b.kontakt?.id ?? ''}
          onChange={(e) => onKontakt(e.target.value || null)}
          className={SELECT_CLASS}
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
      <ContactActions email={b.email} telefon={b.telefon} mobil={b.mobil} />
    </div>
  );
}

function DraftBeteiligterRow({
  draft,
  rolleOptions,
  onPartner,
  onRolle,
  onRemove,
}: {
  draft: DraftRow;
  rolleOptions: RolleOption[];
  onPartner: (pid: string | null) => void;
  onRolle: (v: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className={ROW_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">Neuer Beteiligter</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
          title="Verwerfen"
          aria-label="Verwerfen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RolleSelect value={draft.rolle} options={rolleOptions} onChange={onRolle} />
        <EntitySearchSelect
          value={draft.partnerId}
          onChange={(pid) => onPartner(pid)}
          fetcher={searchPartner}
          queryKey="partner-beteiligter"
          placeholder="Geschäftspartner suchen …"
        />
      </div>
    </div>
  );
}
