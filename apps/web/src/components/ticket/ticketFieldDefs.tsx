/**
 * Ticket-Feld-Definitionen — EINE Quelle pro Feld (Phase 2a, ADR 0006).
 *
 * Früher lagen die Renderer eines Feldes in DREI Dateien verteilt
 * (detailFieldRenderers / createFieldRenderers / VorlagePreviewFelder). Ein
 * Feld-Standard zu ändern hieß, drei Dateien anzufassen. Hier sind alle drei
 * Modi pro Feld an EINER Stelle co-lokalisiert (`TICKET_FIELD_DEFS`), plus der
 * explizite Feldtyp aus `core/felder/fieldTypes`.
 *
 * FM-spezifisch (referenziert TicketRead etc.) → bewusst in `components/ticket/`,
 * NICHT in `core/` (core bleibt FM-frei, CLAUDE.md §3). Nur die generische
 * Taxonomie (`FieldType`) kommt aus `core/felder`.
 *
 * Die drei modus-spezifischen Contexts bleiben getrennt (Detail patcht via
 * `onPatch`, Create steuert via `setField`/RHF, Preview ist disabled) — sie
 * werden NICHT zusammengelegt; nur zusammengeführt. Die Renderer sind hook-frei
 * und damit isoliert (RTL) testbar.
 */
import { Activity, AlertOctagon, FolderKanban, MapPin } from 'lucide-react';

import type {
  AdresseRead,
  AuswahllisteRead,
  HausRead,
  TicketBeteiligterWrite,
  TicketPin,
  TicketPrioritaetSlug,
  TicketRead,
  TicketUpdate,
  TickettypFeldRead,
  UserRead,
} from '../../api/types';
import { ticketFeldType, type FieldType } from '../../core/felder/fieldTypes';
import { aktiveWerte } from '../../lib/aktiveWerte';
import {
  loadProjektLabel,
  makeAnlageSearch,
  makeFehlercodeSearch,
  makeProjektSearch,
  searchObjekte,
} from '../../lib/entitySearch';
import { PRIO_SLUGS, labelForPrioSlug } from '../../lib/format';
import type { VorlageFelderHelfer } from '../../lib/vorlageFelder';
import { BeteiligteBlock } from '../BeteiligteBlock';
import { BeteiligteCreateEditor } from '../BeteiligteCreateEditor';
import { DatePicker } from '../DatePicker';
import { EntitySearchSelect } from '../EntitySearchSelect';
import { GrundrissPin } from '../GrundrissPin';
import { PhotoGallery } from '../PhotoGallery';
import { TicketAdresseField } from '../TicketAdresseField';
import { TicketDokumente } from '../TicketDokumente';
import { FeldSearchSelect, FeldSelect, SelectField } from './primitives';

// ---------------------------------------------------------------------------
// Contexts (pro Modus eigener Context — bewusst getrennt)
// ---------------------------------------------------------------------------

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

type DetailRenderer = (ctx: DetailFieldCtx) => React.ReactNode;
type CreateRenderer = (ctx: CreateFieldCtx) => React.ReactNode;
type PreviewRenderer = (feld: TickettypFeldRead) => React.ReactNode;

export interface TicketFieldDef {
  type: FieldType;
  detail: DetailRenderer;
  create: CreateRenderer;
  preview: PreviewRenderer;
}

// ---------------------------------------------------------------------------
// Shared style helpers (collision-frei umbenannt: detail* vs create*)
// ---------------------------------------------------------------------------

const detailInputClass =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

function detailLabelCls() {
  return 'block text-[10px] font-semibold uppercase tracking-wider text-zinc-500';
}

const createFieldCls =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const createLabelCls = 'block text-sm font-medium text-zinc-300';

function Pflicht({ on }: { on: boolean }) {
  return on ? <span className="text-red-400">*</span> : null;
}

const PREVIEW_INPUT_CLASS =
  'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60';

function PreviewInput({ id, placeholder = '' }: { id: string; placeholder?: string }) {
  return (
    <input id={id} disabled placeholder={placeholder} className={PREVIEW_INPUT_CLASS} />
  );
}

function PreviewTextarea({ id, placeholder = '' }: { id: string; placeholder?: string }) {
  return (
    <textarea
      id={id}
      disabled
      rows={3}
      placeholder={placeholder}
      className={PREVIEW_INPUT_CLASS}
    />
  );
}

function PreviewSelect({ id, hint }: { id: string; hint: string }) {
  return (
    <select id={id} disabled className={PREVIEW_INPUT_CLASS}>
      <option>— {hint} —</option>
    </select>
  );
}

// ---------------------------------------------------------------------------
// Feld-Definitionen — pro Feld alle drei Modi an EINER Stelle.
// Reihenfolge = DEFAULT_SYSTEM_FELDER (Backend). Bodies 1:1 aus den früheren
// drei Registries; nur die labelCls-Helper sind umbenannt (s. o.).
// ---------------------------------------------------------------------------

export const TICKET_FIELD_DEFS: Record<string, TicketFieldDef> = {
  titel: {
    type: ticketFeldType('titel'),
    detail: ({ t, onPatch }) => (
      <div>
        <label className={detailLabelCls()}>Titel</label>
        <input
          key={`titel-${t.id}`}
          defaultValue={t.titel}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== t.titel) onPatch({ titel: v });
          }}
          className={detailInputClass}
        />
      </div>
    ),
    create: ({ values, setField, felder }) => (
      <div>
        <label htmlFor="titel" className={createLabelCls}>
          Titel <Pflicht on={felder.pflicht('titel')} />
        </label>
        <input
          id="titel"
          value={values.titel}
          onChange={(e) => setField('titel', e.target.value)}
          autoFocus
          placeholder="Kurze Beschreibung des Problems"
          className={createFieldCls}
        />
      </div>
    ),
    preview: (f) => (
      <PreviewInput
        id={`preview-${f.feld_key}`}
        placeholder="Kurze Beschreibung des Problems"
      />
    ),
  },

  beschreibung: {
    type: ticketFeldType('beschreibung'),
    detail: ({ t, onPatch }) => (
      <div>
        <label className={detailLabelCls()}>Beschreibung</label>
        <textarea
          key={`besch-${t.id}`}
          rows={4}
          defaultValue={t.beschreibung ?? ''}
          onBlur={(e) => {
            if (e.target.value !== (t.beschreibung ?? ''))
              onPatch({ beschreibung: e.target.value });
          }}
          placeholder="Details zur Störung"
          className={detailInputClass}
        />
      </div>
    ),
    create: ({ values, setField, felder }) => (
      <div>
        <label htmlFor="beschreibung" className={createLabelCls}>
          Beschreibung <Pflicht on={felder.pflicht('beschreibung')} />
        </label>
        <textarea
          id="beschreibung"
          rows={3}
          value={values.beschreibung}
          onChange={(e) => setField('beschreibung', e.target.value)}
          className={createFieldCls}
        />
      </div>
    ),
    preview: (f) => (
      <PreviewTextarea id={`preview-${f.feld_key}`} placeholder="Details zur Störung" />
    ),
  },

  faelligkeit_am: {
    type: ticketFeldType('faelligkeit_am'),
    detail: ({ t, felder, onPatch }) => (
      <div>
        <label className="block text-xs text-zinc-400">
          Fällig am
          {felder.pflicht('faelligkeit_am') && <span className="text-red-400"> *</span>}
        </label>
        <DatePicker
          value={t.faelligkeit_am ?? null}
          onChange={(iso) => onPatch({ faelligkeit_am: iso })}
          placeholder="Fällig am wählen …"
          className="mt-1"
        />
      </div>
    ),
    create: ({ values, setField, felder }) => (
      <div>
        <label className={createLabelCls}>
          Fälligkeit <Pflicht on={felder.pflicht('faelligkeit_am')} />
        </label>
        <DatePicker
          value={values.faelligkeit_am ?? null}
          onChange={(iso) => setField('faelligkeit_am', iso)}
          placeholder="Fälligkeit wählen …"
          className="mt-1"
        />
      </div>
    ),
    preview: () => (
      <DatePicker value={null} onChange={() => {}} disabled className="mt-1" />
    ),
  },

  wiederholung: {
    type: ticketFeldType('wiederholung'),
    detail: ({ t, onPatch }) => (
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
    create: ({ values, setField }) => (
      <div>
        <label className={createLabelCls}>Wiederholung</label>
        <select
          value={values.wiederholung ?? ''}
          onChange={(e) => setField('wiederholung', e.target.value || null)}
          className={createFieldCls}
        >
          <option value="">— (keine) —</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
          <option value="quarterly">Quartalsweise</option>
          <option value="yearly">Jährlich</option>
        </select>
      </div>
    ),
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Wiederholung" />,
  },

  partner: {
    type: ticketFeldType('partner'),
    detail: ({ t, onPatch, beteiligtenRolleOptions }) => (
      <div>
        <div className="mb-1 text-xs text-zinc-400">Beteiligte</div>
        <BeteiligteBlock
          beteiligte={t.beteiligte}
          rolleOptions={beteiligtenRolleOptions}
          onChange={(beteiligte) => onPatch({ beteiligte })}
        />
      </div>
    ),
    create: ({ setBeteiligte, beteiligtenRolleOptions, felder }) => (
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
    preview: () => (
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Beteiligte: mehrere Geschäftspartner + Ansprechpartner mit Rolle.
      </div>
    ),
  },

  objekt: {
    type: ticketFeldType('objekt'),
    detail: ({ t, felder, onPatch }) => (
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
    create: ({ values, setField, felder }) => (
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
    preview: (f) => (
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Objekt auswählen" />
    ),
  },

  haus: {
    type: ticketFeldType('haus'),
    detail: ({ t, hausTree, onPatch }) => (
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
    create: ({ values, setField, hausTree }) => (
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
          className={`${createFieldCls} disabled:opacity-50`}
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Haus" />,
  },

  stockwerk: {
    type: ticketFeldType('stockwerk'),
    detail: ({ t, hausTree, onPatch }) => {
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
    create: ({ values, setField, hausTree }) => {
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
            className={`${createFieldCls} disabled:opacity-50`}
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Stockwerk" />,
  },

  einheit: {
    type: ticketFeldType('einheit'),
    detail: ({ t, hausTree, onPatch }) => {
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
    create: ({ values, setField, hausTree }) => {
      const haus = hausTree?.find((h) => h.id === values.haus_id);
      const stockwerk = haus?.stockwerke.find((s) => s.id === values.stockwerk_id);
      return (
        <div>
          <label className="block text-xs text-zinc-400">Einheit</label>
          <select
            disabled={!values.stockwerk_id}
            value={values.einheit_id ?? ''}
            onChange={(e) => setField('einheit_id', e.target.value || null)}
            className={`${createFieldCls} disabled:opacity-50`}
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Einheit" />,
  },

  adresse: {
    type: ticketFeldType('adresse'),
    detail: ({ t, onPatch }) => (
      <TicketAdresseField
        adresse={t.adresse}
        isEigen={!!t.adresse_id}
        onSet={(adresse_id) => onPatch({ adresse_id })}
      />
    ),
    create: ({ adresseId, selectedAdresse, objektDetail, onAdresse }) => (
      <TicketAdresseField
        adresse={adresseId ? selectedAdresse : (objektDetail?.adresse ?? null)}
        isEigen={!!adresseId}
        onSet={(id, a) => onAdresse(id, a)}
      />
    ),
    preview: () => (
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Adresse (Objekt-Default, überschreibbar) + Google-Maps-Link.
      </div>
    ),
  },

  anlage: {
    type: ticketFeldType('anlage'),
    detail: ({ t, felder, onPatch }) => (
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
    create: ({ values, setField, felder }) => (
      <div>
        <label className={createLabelCls}>
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Anlage" />,
  },

  pin: {
    type: ticketFeldType('pin'),
    detail: ({ t, onPatch }) =>
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
    create: ({ values, setField, grundrissStockwerk }) =>
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
    preview: () => (
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Foto-Pin wird beim Ticket per Klick auf den Grundriss gesetzt.
      </div>
    ),
  },

  prio: {
    type: ticketFeldType('prio'),
    detail: ({ t, onPatch }) => (
      <SelectField
        label="Priorität"
        value={t.prioritaet.key}
        onChange={(v) => onPatch({ prioritaet: v as TicketPrioritaetSlug })}
        options={PRIO_SLUGS.map((p) => ({ value: p, label: labelForPrioSlug(p) }))}
      />
    ),
    create: ({ values, setField }) => (
      <div>
        <label className={createLabelCls}>Priorität</label>
        <select
          value={values.prioritaet}
          onChange={(e) => setField('prioritaet', e.target.value)}
          className={createFieldCls}
        >
          <option value="niedrig">Niedrig</option>
          <option value="mittel">Mittel</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </div>
    ),
    preview: (f) => (
      <PreviewSelect id={`preview-${f.feld_key}`} hint="Priorität wählen" />
    ),
  },

  kategorie: {
    type: ticketFeldType('kategorie'),
    detail: ({ t, onPatch, kategorienListe }) => (
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
    create: ({ values, setField, kategorienListe, felder }) => (
      <div>
        <label className={createLabelCls}>
          Kategorie <Pflicht on={felder.pflicht('kategorie')} />
        </label>
        <select
          value={values.kategorie ?? ''}
          onChange={(e) => setField('kategorie', e.target.value || null)}
          className={createFieldCls}
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Kategorie" />,
  },

  quelle: {
    type: ticketFeldType('quelle'),
    detail: ({ t, onPatch, quellenListe }) => (
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
    create: ({ values, setField, quellenListe }) => (
      <div>
        <label className={createLabelCls}>Quelle</label>
        <select
          value={values.quelle ?? ''}
          onChange={(e) => setField('quelle', e.target.value || null)}
          className={createFieldCls}
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Eingangskanal" />,
  },

  projekt: {
    type: ticketFeldType('projekt'),
    detail: ({ t, onPatch }) => (
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
    create: ({ values, setField }) => (
      <div>
        <label className={createLabelCls}>
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Projekt" />,
  },

  fehlercode: {
    type: ticketFeldType('fehlercode'),
    detail: ({ t, felder, onPatch }) => (
      <FeldSearchSelect
        label="Fehlercode"
        icon={<AlertOctagon className="h-3.5 w-3.5 text-amber-400" />}
        pflicht={felder.pflicht('fehlercode')}
        value={t.fehlercode?.id ?? ''}
        initialLabel={
          t.fehlercode ? `${t.fehlercode.code} — ${t.fehlercode.titel}` : null
        }
        onChange={(id) => onPatch({ fehlercode_id: id })}
        fetcher={makeFehlercodeSearch(t.anlage?.id)}
        queryKey={`fehlercode-detail-${t.anlage?.id ?? 'all'}`}
        placeholder="Fehlercode suchen …"
      />
    ),
    create: ({ values, setField, felder }) => (
      <div>
        <label className={createLabelCls}>
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
    preview: (f) => <PreviewSelect id={`preview-${f.feld_key}`} hint="Fehlercode" />,
  },

  foto: {
    type: ticketFeldType('foto'),
    detail: ({ t }) => <PhotoGallery ticketId={t.id} />,
    create: () => (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
        Foto-Upload erfolgt nach dem Anlegen am Ticket.
      </div>
    ),
    preview: () => (
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Foto-Upload erfolgt nach Anlage am Ticket.
      </div>
    ),
  },

  dokumente: {
    type: ticketFeldType('dokumente'),
    detail: ({ t }) => <TicketDokumente ticketId={t.id} />,
    create: () => (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
        Dokumente werden nach dem Anlegen am Ticket verknüpft.
      </div>
    ),
    preview: () => (
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        Dokumente werden nach Anlage am Ticket verknüpft.
      </div>
    ),
  },
};

// ---------------------------------------------------------------------------
// Dispatch — modus-spezifische Render-Funktionen (Signaturen unverändert).
// Back-compat: die alten Dateien re-exportieren diese.
// ---------------------------------------------------------------------------

export function renderDetailFeld(feldKey: string, ctx: DetailFieldCtx): React.ReactNode {
  const def = TICKET_FIELD_DEFS[feldKey];
  return def ? def.detail(ctx) : null;
}

export function renderCreateFeld(feldKey: string, ctx: CreateFieldCtx): React.ReactNode {
  const def = TICKET_FIELD_DEFS[feldKey];
  return def ? def.create(ctx) : null;
}

/** Vorschau (Designer): Fallback auf ein disabled Input mit dem Feld-Label. */
export function renderInput(feld: TickettypFeldRead): React.ReactNode {
  const def = TICKET_FIELD_DEFS[feld.feld_key];
  if (def) return def.preview(feld);
  return <PreviewInput id={`preview-${feld.feld_key}`} placeholder={feld.label} />;
}
