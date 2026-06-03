import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Plus, Smartphone, Trash2, UserPlus, Users2, X } from 'lucide-react';
import { partnerApi } from '../../api/endpoints';
import type { Beteiligter, BeteiligterWrite } from '../../api/types';
import { EntitySearchSelect } from '../EntitySearchSelect';
import { searchPartner } from '../../lib/entitySearch';

interface RolleOption {
  id: string;
  label: string;
}

interface StrukturBeteiligteBlockProps {
  beteiligte: Beteiligter[];
  rolleOptions: RolleOption[];
  /** Receives the full new list (Voll-Replace) whenever something changes. */
  onChange: (next: BeteiligterWrite[]) => void;
  /** Meldet ein offenes Quick-Create-Modal nach oben (ESC/Backdrop des Overlays sperren). */
  onInteractionLockChange?: (locked: boolean) => void;
}

interface DraftRow {
  key: string;
  partnerId: string | null;
  rolleId: string | null;
}

function toWrite(b: Beteiligter): BeteiligterWrite {
  return {
    id: b.id,
    partner_id: b.partner_id,
    rolle_id: b.rolle_id,
  };
}

let draftCounter = 0;

/**
 * Beteiligte an einem Struktur-Knoten (Haus / Stockwerk / Einheit): beliebig viele
 * Geschäftspartner mit freier Rolle (Auswahlliste `objekt_beteiligten_rolle`).
 * Ersetzt die getrennten Eigentümer/Mieter-Blöcke. Voll-Replace-Liste: jede
 * Änderung emittiert die komplette neue Liste. Partner direkt anlegbar (Quick-Create).
 */
export function StrukturBeteiligteBlock({
  beteiligte,
  rolleOptions,
  onChange,
  onInteractionLockChange,
}: StrukturBeteiligteBlockProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [quickCreateFor, setQuickCreateFor] = useState<string | null>(null);

  const savedWrites = useMemo(() => beteiligte.map(toWrite), [beteiligte]);

  function patchSaved(id: string, patch: Partial<BeteiligterWrite>) {
    onChange(savedWrites.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  function removeSaved(id: string) {
    onChange(savedWrites.filter((w) => w.id !== id));
  }

  function addDraft() {
    draftCounter += 1;
    setDrafts((d) => [
      ...d,
      {
        key: `draft-${draftCounter}`,
        partnerId: null,
        rolleId: rolleOptions[0]?.id ?? null,
      },
    ]);
  }

  function updateDraft(key: string, patch: Partial<DraftRow>) {
    setDrafts((d) => d.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeDraft(key: string) {
    setDrafts((d) => d.filter((row) => row.key !== key));
  }

  /** Einen gewählten Partner an die Server-Liste committen (Draft auflösen). */
  function commit(partnerId: string, rolleId: string | null, fromDraftKey?: string) {
    onChange([...savedWrites, { partner_id: partnerId, rolle_id: rolleId }]);
    if (fromDraftKey) removeDraft(fromDraftKey);
  }

  return (
    <div className="space-y-2">
      {beteiligte.length === 0 && drafts.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Users2 className="h-3.5 w-3.5" /> Noch keine Beteiligten zugeordnet.
        </p>
      )}

      {beteiligte.map((b) => (
        <SavedBeteiligterRow
          key={b.id}
          b={b}
          rolleOptions={rolleOptions}
          onRolle={(rolleId) => patchSaved(b.id, { rolle_id: rolleId })}
          onRemove={() => removeSaved(b.id)}
        />
      ))}

      {drafts.map((d) => (
        <DraftBeteiligterRow
          key={d.key}
          draft={d}
          rolleOptions={rolleOptions}
          onPartner={(pid) => {
            if (pid) commit(pid, d.rolleId, d.key);
            else updateDraft(d.key, { partnerId: pid });
          }}
          onRolle={(rolleId) => updateDraft(d.key, { rolleId })}
          onQuickCreate={() => setQuickCreateFor(d.key)}
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

      {quickCreateFor !== null && (
        <PartnerQuickCreateModal
          onClose={() => {
            setQuickCreateFor(null);
            onInteractionLockChange?.(false);
          }}
          onCreated={(partnerId) => {
            const draft = drafts.find((d) => d.key === quickCreateFor);
            commit(
              partnerId,
              draft?.rolleId ?? rolleOptions[0]?.id ?? null,
              quickCreateFor,
            );
            setQuickCreateFor(null);
            onInteractionLockChange?.(false);
          }}
          onOpen={() => onInteractionLockChange?.(true)}
        />
      )}
    </div>
  );
}

// ============================================================================

const ROW_CLASS = 'rounded-md border border-zinc-800 bg-zinc-950/40 p-2 space-y-2';
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
        <option key={o.id} value={o.id}>
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
  if (!email && !telefon && !mobil) return null;
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
  onRemove,
}: {
  b: Beteiligter;
  rolleOptions: RolleOption[];
  onRolle: (v: string | null) => void;
  onRemove: () => void;
}) {
  // Kontaktdaten (mailto/tel) aus dem Partner-Stamm — klickbar (Standard Tim 2026-06-03).
  const partnerQuery = useQuery({
    queryKey: ['partner-detail-contact', b.partner_id],
    queryFn: () => partnerApi.get(b.partner_id),
    staleTime: 60_000,
  });

  return (
    <div className={ROW_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-100">
          {b.partner_name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
          title="Beteiligten entfernen"
          aria-label="Entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <RolleSelect value={b.rolle_id} options={rolleOptions} onChange={onRolle} />
      <ContactActions
        email={partnerQuery.data?.email ?? null}
        telefon={partnerQuery.data?.telefon ?? null}
        mobil={partnerQuery.data?.mobil ?? null}
      />
    </div>
  );
}

function DraftBeteiligterRow({
  draft,
  rolleOptions,
  onPartner,
  onRolle,
  onQuickCreate,
  onRemove,
}: {
  draft: DraftRow;
  rolleOptions: RolleOption[];
  onPartner: (pid: string | null) => void;
  onRolle: (v: string | null) => void;
  onQuickCreate: () => void;
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
        <RolleSelect value={draft.rolleId} options={rolleOptions} onChange={onRolle} />
        <EntitySearchSelect
          value={draft.partnerId}
          onChange={(pid) => onPartner(pid)}
          fetcher={searchPartner}
          queryKey="struktur-beteiligter"
          placeholder="Geschäftspartner suchen …"
        />
      </div>
      <button
        type="button"
        onClick={onQuickCreate}
        className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:underline"
      >
        <UserPlus className="h-3 w-3" /> Partner neu anlegen
      </button>
    </div>
  );
}

// ============================================================================
// Quick-Create — Geschäftspartner direkt aus dem Beteiligten-Picker anlegen
// ============================================================================

function PartnerQuickCreateModal({
  onClose,
  onCreated,
  onOpen,
}: {
  onClose: () => void;
  onCreated: (partnerId: string) => void;
  onOpen: () => void;
}) {
  const [name, setName] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    onOpen();
  }, [onOpen]);

  // ESC schließt nur dieses Modal (Capture, vor dem Overlay-Listener).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const create = useMutation({
    mutationFn: () => partnerApi.create({ name: name.trim(), typen: [] }),
    onSuccess: (partner) => {
      qc.invalidateQueries({ queryKey: ['partner-search'] });
      qc.invalidateQueries({ queryKey: ['partner-browse'] });
      onCreated(partner.id);
    },
  });

  const canSubmit = name.trim().length > 0 && !create.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-quickcreate-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2
            id="partner-quickcreate-title"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-100"
          >
            <UserPlus className="h-4 w-4 text-emerald-400" /> Partner anlegen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="space-y-3 px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
        >
          <div>
            <label
              htmlFor="quickcreate-name"
              className="block text-xs font-medium text-zinc-300"
            >
              Name
            </label>
            <input
              id="quickcreate-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Firmen-/Personenname"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Weitere Stammdaten später im Partner-Modul ergänzbar.
            </p>
          </div>
          {create.isError && (
            <p className="text-xs text-red-400">
              Anlegen fehlgeschlagen. Bitte erneut versuchen.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {create.isPending ? 'Lege an …' : 'Anlegen & zuordnen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
