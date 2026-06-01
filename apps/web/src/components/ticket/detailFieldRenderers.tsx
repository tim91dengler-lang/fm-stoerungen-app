import { Activity, AlertOctagon, FolderKanban, MapPin } from 'lucide-react';

import type {
  AuswahllisteRead,
  HausRead,
  TicketPrioritaetSlug,
  TicketRead,
  TicketUpdate,
} from '../../api/types';
import { aktiveWerte } from '../../lib/aktiveWerte';
import {
  makeAnlageSearch,
  makeFehlercodeSearch,
  makeProjektSearch,
  searchObjekte,
} from '../../lib/entitySearch';
import { PRIO_SLUGS, labelForPrioSlug } from '../../lib/format';
import type { VorlageFelderHelfer } from '../../lib/vorlageFelder';
import { BeteiligteBlock } from '../BeteiligteBlock';
import { GrundrissPin } from '../GrundrissPin';
import { PhotoGallery } from '../PhotoGallery';
import { TicketAdresseField } from '../TicketAdresseField';
import { TicketDokumente } from '../TicketDokumente';
import { FeldSearchSelect, FeldSelect, SelectField } from './primitives';

/**
 * Detail-Modus Feld-Renderer-Registry (Stufe C, hinter Flag).
 *
 * Pro `feld_key` ein reiner Renderer `(ctx) => ReactNode` — die gesamte Daten-/
 * Mutations-Anbindung kommt über `ctx`, sodass die Renderer ohne eigene Hooks
 * auskommen und isoliert (RTL) testbar sind. Das Markup ist 1:1 aus dem bisherigen
 * TicketDetailPanel übernommen; die Spezial-Widgets (BeteiligteBlock, GrundrissPin,
 * TicketAdresseField, PhotoGallery, TicketDokumente, EntitySearchSelect) bleiben
 * unverändert und werden nur aus der Registry aufgerufen.
 */

export interface DetailFieldCtx {
  t: TicketRead;
  felder: VorlageFelderHelfer;
  /** = update.mutate — patcht das Ticket. */
  onPatch: (patch: TicketUpdate) => void;
  hausTree: HausRead[] | undefined;
  kategorienListe: AuswahllisteRead | undefined;
  quellenListe: AuswahllisteRead | undefined;
  beteiligtenRolleOptions: { key: string; label: string }[];
}

type Renderer = (ctx: DetailFieldCtx) => React.ReactNode;

const inputClass =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

function labelCls() {
  return 'block text-[10px] font-semibold uppercase tracking-wider text-zinc-500';
}

export const DETAIL_RENDERERS: Record<string, Renderer> = {
  titel: ({ t, onPatch }) => (
    <div>
      <label className={labelCls()}>Titel</label>
      <input
        key={`titel-${t.id}`}
        defaultValue={t.titel}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== t.titel) onPatch({ titel: v });
        }}
        className={inputClass}
      />
    </div>
  ),

  beschreibung: ({ t, onPatch }) => (
    <div>
      <label className={labelCls()}>Beschreibung</label>
      <textarea
        key={`besch-${t.id}`}
        rows={4}
        defaultValue={t.beschreibung ?? ''}
        onBlur={(e) => {
          if (e.target.value !== (t.beschreibung ?? ''))
            onPatch({ beschreibung: e.target.value });
        }}
        placeholder="Details zur Störung"
        className={inputClass}
      />
    </div>
  ),

  faelligkeit_am: ({ t, felder, onPatch }) => (
    <div>
      <label className="block text-xs text-zinc-400">
        Fällig am
        {felder.pflicht('faelligkeit_am') && <span className="text-red-400"> *</span>}
      </label>
      <input
        type="date"
        value={t.faelligkeit_am ?? ''}
        onChange={(e) => onPatch({ faelligkeit_am: e.target.value || null })}
        // Klick aufs ganze Feld öffnet den Kalender (nativ nur übers Icon).
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            /* showPicker nicht unterstützt — natives Verhalten bleibt */
          }
        }}
        className="mt-1 w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
      />
    </div>
  ),

  wiederholung: ({ t, onPatch }) => (
    <FeldSelect
      label="Wiederholung"
      value={t.wiederholung ?? ''}
      onChange={(v) => onPatch({ wiederholung: v || null })}
    >
      <option value="">— (keine) —</option>
      <option value="weekly">Wöchentlich</option>
      <option value="monthly">Monatlich</option>
      <option value="quarterly">Quartalsweise</option>
      <option value="yearly">Jährlich</option>
    </FeldSelect>
  ),

  partner: ({ t, onPatch, beteiligtenRolleOptions }) => (
    <div>
      <div className="mb-1 text-xs text-zinc-400">Beteiligte</div>
      <BeteiligteBlock
        beteiligte={t.beteiligte}
        rolleOptions={beteiligtenRolleOptions}
        onChange={(beteiligte) => onPatch({ beteiligte })}
      />
    </div>
  ),

  objekt: ({ t, felder, onPatch }) => (
    <FeldSearchSelect
      label="Objekt"
      pflicht={felder.pflicht('objekt')}
      value={t.objekt?.id ?? ''}
      initialLabel={t.objekt?.name ?? null}
      onChange={(id) =>
        onPatch({ objekt_id: id, haus_id: null, stockwerk_id: null, einheit_id: null })
      }
      fetcher={searchObjekte}
      queryKey="objekt-detail"
      placeholder="Objekt suchen …"
    />
  ),

  haus: ({ t, hausTree, onPatch }) => (
    <FeldSelect
      label="Haus"
      disabled={!t.objekt}
      value={t.haus?.id ?? ''}
      onChange={(v) =>
        onPatch({ haus_id: v || null, stockwerk_id: null, einheit_id: null })
      }
    >
      <option value="">— (keins) —</option>
      {hausTree?.map((h) => (
        <option key={h.id} value={h.id}>
          {h.bezeichnung}
        </option>
      ))}
    </FeldSelect>
  ),

  stockwerk: ({ t, hausTree, onPatch }) => {
    const selectedHaus = hausTree?.find((h) => h.id === t.haus?.id);
    return (
      <FeldSelect
        label="Stockwerk"
        disabled={!t.haus}
        value={t.stockwerk?.id ?? ''}
        onChange={(v) => onPatch({ stockwerk_id: v || null, einheit_id: null })}
      >
        <option value="">— (keins) —</option>
        {selectedHaus?.stockwerke?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.bezeichnung}
            {s.ausrichtung ? ` · ${s.ausrichtung}` : ''}
          </option>
        ))}
      </FeldSelect>
    );
  },

  einheit: ({ t, hausTree, onPatch }) => {
    const selectedHaus = hausTree?.find((h) => h.id === t.haus?.id);
    const selectedStockwerk = selectedHaus?.stockwerke?.find(
      (s) => s.id === t.stockwerk?.id,
    );
    return (
      <FeldSelect
        label="Einheit"
        disabled={!t.stockwerk}
        value={t.einheit?.id ?? ''}
        onChange={(v) => onPatch({ einheit_id: v || null })}
      >
        <option value="">— (keine) —</option>
        {selectedStockwerk?.einheiten?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.bezeichnung}
          </option>
        ))}
      </FeldSelect>
    );
  },

  adresse: ({ t, onPatch }) => (
    <TicketAdresseField
      adresse={t.adresse}
      isEigen={!!t.adresse_id}
      onSet={(adresse_id) => onPatch({ adresse_id })}
    />
  ),

  anlage: ({ t, felder, onPatch }) => (
    <FeldSearchSelect
      label="Anlage"
      icon={<Activity className="h-3.5 w-3.5" />}
      pflicht={felder.pflicht('anlage')}
      value={t.anlage?.id ?? ''}
      initialLabel={t.anlage?.bezeichnung ?? null}
      onChange={(id) => onPatch({ anlage_id: id })}
      fetcher={makeAnlageSearch(t.objekt?.id)}
      queryKey={`anlage-detail-${t.objekt?.id ?? 'all'}`}
      placeholder="Anlage suchen …"
    />
  ),

  pin: ({ t, onPatch }) =>
    t.stockwerk?.has_grundriss ? (
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <MapPin className="h-3.5 w-3.5" /> Lage im Grundriss
        </div>
        <GrundrissPin
          stockwerkId={t.stockwerk.id}
          pins={t.pins ?? []}
          onChange={(pins) => onPatch({ pins })}
        />
      </div>
    ) : (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        Grundriss-Pin: benötigt ein sichtbares Stockwerk mit Grundriss.
      </div>
    ),

  prio: ({ t, onPatch }) => (
    <SelectField
      label="Priorität"
      value={t.prioritaet.key}
      onChange={(v) => onPatch({ prioritaet: v as TicketPrioritaetSlug })}
      options={PRIO_SLUGS.map((p) => ({ value: p, label: labelForPrioSlug(p) }))}
    />
  ),

  kategorie: ({ t, onPatch, kategorienListe }) => (
    <SelectField
      label="Kategorie"
      value={t.kategorie?.key ?? ''}
      onChange={(v) => onPatch({ kategorie: v || null })}
      options={[
        { value: '', label: '— (keine) —' },
        ...aktiveWerte(kategorienListe?.werte, t.kategorie?.key).map((w) => ({
          value: w.key,
          label: w.label,
        })),
      ]}
    />
  ),

  quelle: ({ t, onPatch, quellenListe }) => (
    <FeldSelect
      label="Quelle"
      value={t.quelle?.key ?? ''}
      onChange={(v) => onPatch({ quelle: v || null })}
    >
      <option value="">— (keine) —</option>
      {aktiveWerte(quellenListe?.werte, t.quelle?.key).map((w) => (
        <option key={w.id} value={w.key}>
          {w.label}
        </option>
      ))}
    </FeldSelect>
  ),

  projekt: ({ t, onPatch }) => (
    <FeldSearchSelect
      label="Projekt"
      icon={<FolderKanban className="h-3.5 w-3.5" />}
      value={t.projekt?.id ?? ''}
      initialLabel={t.projekt?.name ?? null}
      onChange={(id) => onPatch({ projekt_id: id })}
      fetcher={makeProjektSearch(['geplant', 'aktiv'])}
      queryKey="projekt-detail"
      placeholder="Projekt suchen …"
    />
  ),

  fehlercode: ({ t, felder, onPatch }) => (
    <FeldSearchSelect
      label="Fehlercode"
      icon={<AlertOctagon className="h-3.5 w-3.5 text-amber-400" />}
      pflicht={felder.pflicht('fehlercode')}
      value={t.fehlercode?.id ?? ''}
      initialLabel={t.fehlercode ? `${t.fehlercode.code} — ${t.fehlercode.titel}` : null}
      onChange={(id) => onPatch({ fehlercode_id: id })}
      fetcher={makeFehlercodeSearch(t.anlage?.id)}
      queryKey={`fehlercode-detail-${t.anlage?.id ?? 'all'}`}
      placeholder="Fehlercode suchen …"
    />
  ),

  foto: ({ t }) => <PhotoGallery ticketId={t.id} />,

  dokumente: ({ t }) => <TicketDokumente ticketId={t.id} />,
};

/** Fallback für unbekannte Feld-Keys (defensiv — sollte mit Katalog nicht auftreten). */
export function renderDetailFeld(feldKey: string, ctx: DetailFieldCtx): React.ReactNode {
  const r = DETAIL_RENDERERS[feldKey];
  return r ? r(ctx) : null;
}
