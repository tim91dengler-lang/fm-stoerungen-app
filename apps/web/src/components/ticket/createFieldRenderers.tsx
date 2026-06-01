import { Activity, AlertOctagon, FolderKanban } from 'lucide-react';

import type {
  AdresseRead,
  AuswahllisteRead,
  HausRead,
  TicketPin,
  UserRead,
} from '../../api/types';
import { aktiveWerte } from '../../lib/aktiveWerte';
import {
  loadProjektLabel,
  makeAnlageSearch,
  makeFehlercodeSearch,
  makeProjektSearch,
  searchObjekte,
} from '../../lib/entitySearch';
import type { VorlageFelderHelfer } from '../../lib/vorlageFelder';
import { BeteiligteCreateEditor } from '../BeteiligteCreateEditor';
import { EntitySearchSelect } from '../EntitySearchSelect';
import { GrundrissPin } from '../GrundrissPin';
import { TicketAdresseField } from '../TicketAdresseField';
import type { TicketBeteiligterWrite } from '../../api/types';

/**
 * Create-Modus Feld-Renderer-Registry (Stufe C, hinter Flag).
 *
 * Spiegelt die Felder des Erfassen-Modals, aber controlled über `setField`
 * (= react-hook-form setValue) + die beobachteten `values`. So bleibt die
 * Form-State-Quelle die RHF-Instanz (kein Parallel-State, H5), die Renderer
 * selbst sind hook-frei und damit testbar.
 */

export interface CreateFieldValues {
  titel: string;
  beschreibung: string;
  prioritaet: string;
  kategorie: string | null;
  quelle: string | null;
  wiederholung: string | null;
  faelligkeit_am: string | null;
  objekt_id: string | null;
  haus_id: string | null;
  stockwerk_id: string | null;
  einheit_id: string | null;
  anlage_id: string | null;
  fehlercode_id: string | null;
  projekt_id: string | null;
  zugewiesen_an_id: string | null;
  pins: TicketPin[];
}

export interface CreateFieldCtx {
  felder: VorlageFelderHelfer;
  values: CreateFieldValues;
  setField: <K extends keyof CreateFieldValues>(
    name: K,
    value: CreateFieldValues[K],
  ) => void;
  beteiligte: TicketBeteiligterWrite[];
  setBeteiligte: (b: TicketBeteiligterWrite[]) => void;
  adresseId: string | null;
  selectedAdresse: AdresseRead | null;
  objektDetail: { adresse: AdresseRead | null } | null;
  onAdresse: (id: string | null, a: AdresseRead | null) => void;
  hausTree: HausRead[] | undefined;
  kategorienListe: AuswahllisteRead | undefined;
  quellenListe: AuswahllisteRead | undefined;
  users: UserRead[] | undefined;
  beteiligtenRolleOptions: { key: string; label: string }[];
  grundrissStockwerk: { has_grundriss: boolean } | undefined;
}

type Renderer = (ctx: CreateFieldCtx) => React.ReactNode;

const fieldCls =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const labelCls = 'block text-sm font-medium text-zinc-300';

function Pflicht({ on }: { on: boolean }) {
  return on ? <span className="text-red-400">*</span> : null;
}

export const CREATE_RENDERERS: Record<string, Renderer> = {
  titel: ({ values, setField, felder }) => (
    <div>
      <label htmlFor="titel" className={labelCls}>
        Titel <Pflicht on={felder.pflicht('titel')} />
      </label>
      <input
        id="titel"
        value={values.titel}
        onChange={(e) => setField('titel', e.target.value)}
        autoFocus
        placeholder="Kurze Beschreibung des Problems"
        className={fieldCls}
      />
    </div>
  ),

  beschreibung: ({ values, setField, felder }) => (
    <div>
      <label htmlFor="beschreibung" className={labelCls}>
        Beschreibung <Pflicht on={felder.pflicht('beschreibung')} />
      </label>
      <textarea
        id="beschreibung"
        rows={3}
        value={values.beschreibung}
        onChange={(e) => setField('beschreibung', e.target.value)}
        className={fieldCls}
      />
    </div>
  ),

  prio: ({ values, setField }) => (
    <div>
      <label className={labelCls}>Priorität</label>
      <select
        value={values.prioritaet}
        onChange={(e) => setField('prioritaet', e.target.value)}
        className={fieldCls}
      >
        <option value="niedrig">Niedrig</option>
        <option value="mittel">Mittel</option>
        <option value="hoch">Hoch</option>
        <option value="kritisch">Kritisch</option>
      </select>
    </div>
  ),

  kategorie: ({ values, setField, kategorienListe, felder }) => (
    <div>
      <label className={labelCls}>
        Kategorie <Pflicht on={felder.pflicht('kategorie')} />
      </label>
      <select
        value={values.kategorie ?? ''}
        onChange={(e) => setField('kategorie', e.target.value || null)}
        className={fieldCls}
      >
        <option value="">— (keine) —</option>
        {aktiveWerte(kategorienListe?.werte).map((w) => (
          <option key={w.id} value={w.key}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  ),

  quelle: ({ values, setField, quellenListe }) => (
    <div>
      <label className={labelCls}>Quelle</label>
      <select
        value={values.quelle ?? ''}
        onChange={(e) => setField('quelle', e.target.value || null)}
        className={fieldCls}
      >
        <option value="">— (keine) —</option>
        {aktiveWerte(quellenListe?.werte).map((w) => (
          <option key={w.id} value={w.key}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  ),

  objekt: ({ values, setField, felder }) => (
    <div>
      <label className="block text-xs text-zinc-400">
        Objekt <Pflicht on={felder.pflicht('objekt')} />
      </label>
      <div className="mt-1">
        <EntitySearchSelect
          value={values.objekt_id}
          onChange={(id) => {
            setField('objekt_id', id);
            setField('haus_id', null);
            setField('stockwerk_id', null);
            setField('einheit_id', null);
          }}
          fetcher={searchObjekte}
          queryKey="objekt-create-engine"
          placeholder="Objekt suchen …"
        />
      </div>
    </div>
  ),

  haus: ({ values, setField, hausTree }) => (
    <div>
      <label className="block text-xs text-zinc-400">Haus</label>
      <select
        disabled={!values.objekt_id}
        value={values.haus_id ?? ''}
        onChange={(e) => {
          setField('haus_id', e.target.value || null);
          setField('stockwerk_id', null);
          setField('einheit_id', null);
        }}
        className={`${fieldCls} disabled:opacity-50`}
      >
        <option value="">— (keins) —</option>
        {hausTree?.map((h) => (
          <option key={h.id} value={h.id}>
            {h.bezeichnung}
          </option>
        ))}
      </select>
    </div>
  ),

  stockwerk: ({ values, setField, hausTree }) => {
    const haus = hausTree?.find((h) => h.id === values.haus_id);
    return (
      <div>
        <label className="block text-xs text-zinc-400">Stockwerk</label>
        <select
          disabled={!values.haus_id}
          value={values.stockwerk_id ?? ''}
          onChange={(e) => {
            setField('stockwerk_id', e.target.value || null);
            setField('einheit_id', null);
          }}
          className={`${fieldCls} disabled:opacity-50`}
        >
          <option value="">— (keins) —</option>
          {haus?.stockwerke.map((s) => (
            <option key={s.id} value={s.id}>
              {s.bezeichnung}
              {s.ausrichtung ? ` · ${s.ausrichtung}` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  },

  einheit: ({ values, setField, hausTree }) => {
    const haus = hausTree?.find((h) => h.id === values.haus_id);
    const stockwerk = haus?.stockwerke.find((s) => s.id === values.stockwerk_id);
    return (
      <div>
        <label className="block text-xs text-zinc-400">Einheit</label>
        <select
          disabled={!values.stockwerk_id}
          value={values.einheit_id ?? ''}
          onChange={(e) => setField('einheit_id', e.target.value || null)}
          className={`${fieldCls} disabled:opacity-50`}
        >
          <option value="">— (keine) —</option>
          {stockwerk?.einheiten.map((eh) => (
            <option key={eh.id} value={eh.id}>
              {eh.bezeichnung}
            </option>
          ))}
        </select>
      </div>
    );
  },

  adresse: ({ adresseId, selectedAdresse, objektDetail, onAdresse }) => (
    <TicketAdresseField
      adresse={adresseId ? selectedAdresse : (objektDetail?.adresse ?? null)}
      isEigen={!!adresseId}
      onSet={(id, a) => onAdresse(id, a)}
    />
  ),

  anlage: ({ values, setField, felder }) => (
    <div>
      <label className={labelCls}>
        <Activity className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-emerald-400" />
        Anlage <Pflicht on={felder.pflicht('anlage')} />
      </label>
      <div className="mt-1">
        <EntitySearchSelect
          value={values.anlage_id}
          onChange={(id) => setField('anlage_id', id)}
          fetcher={makeAnlageSearch(values.objekt_id ?? undefined)}
          queryKey={`anlage-create-${values.objekt_id ?? 'all'}`}
          placeholder="Anlage suchen …"
        />
      </div>
    </div>
  ),

  fehlercode: ({ values, setField, felder }) => (
    <div>
      <label className={labelCls}>
        <AlertOctagon className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-amber-400" />
        Fehlercode <Pflicht on={felder.pflicht('fehlercode')} />
      </label>
      <div className="mt-1">
        <EntitySearchSelect
          value={values.fehlercode_id}
          onChange={(id) => setField('fehlercode_id', id)}
          fetcher={makeFehlercodeSearch(values.anlage_id ?? undefined)}
          queryKey={`fehlercode-create-${values.anlage_id ?? 'all'}`}
          placeholder="Fehlercode suchen …"
        />
      </div>
    </div>
  ),

  projekt: ({ values, setField }) => (
    <div>
      <label className={labelCls}>
        <FolderKanban className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
        Projekt
      </label>
      <div className="mt-1">
        <EntitySearchSelect
          value={values.projekt_id}
          onChange={(id) => setField('projekt_id', id)}
          fetcher={makeProjektSearch(['geplant', 'aktiv'])}
          loadLabel={loadProjektLabel}
          queryKey="projekt-create-engine"
          placeholder="Projekt suchen …"
        />
      </div>
    </div>
  ),

  faelligkeit_am: ({ values, setField, felder }) => (
    <div>
      <label className={labelCls}>
        Fälligkeit <Pflicht on={felder.pflicht('faelligkeit_am')} />
      </label>
      <input
        type="date"
        value={values.faelligkeit_am ?? ''}
        onChange={(e) => setField('faelligkeit_am', e.target.value || null)}
        className={fieldCls}
      />
    </div>
  ),

  wiederholung: ({ values, setField }) => (
    <div>
      <label className={labelCls}>Wiederholung</label>
      <select
        value={values.wiederholung ?? ''}
        onChange={(e) => setField('wiederholung', e.target.value || null)}
        className={fieldCls}
      >
        <option value="">— (keine) —</option>
        <option value="weekly">Wöchentlich</option>
        <option value="monthly">Monatlich</option>
        <option value="quarterly">Quartalsweise</option>
        <option value="yearly">Jährlich</option>
      </select>
    </div>
  ),

  partner: ({ setBeteiligte, beteiligtenRolleOptions, felder }) => (
    <div>
      <div className="mb-1 text-sm font-medium text-zinc-300">
        Beteiligte <Pflicht on={felder.pflicht('partner')} />
      </div>
      <BeteiligteCreateEditor
        rolleOptions={beteiligtenRolleOptions}
        onChange={setBeteiligte}
      />
    </div>
  ),

  pin: ({ values, setField, grundrissStockwerk }) =>
    values.stockwerk_id && grundrissStockwerk?.has_grundriss ? (
      <div>
        <div className="mb-1 text-xs text-zinc-400">
          Lage im Grundriss (optional, mehrere möglich)
        </div>
        <GrundrissPin
          stockwerkId={values.stockwerk_id}
          pins={values.pins ?? []}
          onChange={(p) => setField('pins', p)}
        />
      </div>
    ) : null,

  // Detail-only im Erfassen: nur Hinweis (Upload erfolgt nach Anlage).
  foto: () => (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
      Foto-Upload erfolgt nach dem Anlegen am Ticket.
    </div>
  ),
  dokumente: () => (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
      Dokumente werden nach dem Anlegen am Ticket verknüpft.
    </div>
  ),
};

export function renderCreateFeld(feldKey: string, ctx: CreateFieldCtx): React.ReactNode {
  const r = CREATE_RENDERERS[feldKey];
  return r ? r(ctx) : null;
}
