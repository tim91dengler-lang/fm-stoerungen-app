import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  DoorOpen,
  FileText,
  Image as ImageIcon,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users2,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../api/client';
import {
  adresseApi,
  auswahllistenApi,
  objektApi,
  objektstrukturApi,
} from '../../api/endpoints';
import type {
  AdresseRead,
  Ausrichtung,
  BeteiligterWrite,
  HausRead,
  ObjektRead,
  ObjektUpdate,
  StockwerkRead,
  EinheitRead,
} from '../../api/types';
import { HausModal } from '../HausModal';
import { StockwerkModal } from '../StockwerkModal';
import { EinheitModal } from '../EinheitModal';
import { StrukturBeteiligteBlock } from './StrukturBeteiligteBlock';
import { MapsLink } from '../MapsLink';
import { InlineEditEntity, InlineEditText } from '../../core/detail';
import { searchAdressen } from '../../lib/entitySearch';
import { aktiveWerte } from '../../lib/aktiveWerte';
import { ConfirmDialog } from '../../core/liste/ConfirmDialog';

/**
 * Struktur-Editor (Häuser → Stockwerke → Einheiten) als eigenständige Komponente.
 *
 * Aus `ObjektDetailPage` extrahiert (Folge D), damit derselbe Editor sowohl auf
 * der Seite `/stammdaten/objekte/:id` ALS AUCH eingebettet im
 * `ObjektDetailOverlay`-Reiter „Struktur" läuft — eine Quelle, keine Duplikation.
 *
 * Inputs: nur `objektId` (+ optional `objektAdresseId` als Default für neue
 * Haus-Adressen, damit der geteilte `['objekt', objektId]`-Query nicht doppelt
 * feuert). Page-Chrome (Header, Eigentümer-Badges, Back-Link) bleibt in der Seite.
 *
 * Höhen-/Scroll-Kette: Wurzel ist `flex min-h-0 flex-1 overflow-hidden`, beide
 * Grid-Spalten scrollen intern — so läuft der Inhalt im `fixedHeight`-Overlay
 * (85vh) nicht über. Im Seiten-Kontext gibt die Seite eine Höhen-Box drum herum.
 *
 * `onInteractionLockChange`: meldet dem Overlay, dass ein Editor-Modal/Confirm
 * offen ist, damit ESC/Backdrop das Overlay NICHT schließen (die Sub-Modals
 * decken den Screen, haben aber keinen eigenen ESC-Handler).
 */

const AUSRICHTUNG_LABEL: Record<Ausrichtung, string> = {
  nord: '⬆ Nord',
  ost: '➡ Ost',
  sued: '⬇ Süd',
  west: '⬅ West',
};

// Pluralisation helpers
function pluralStockwerke(n: number): string {
  return `${n} Stockwerk${n === 1 ? '' : 'e'}`;
}
function pluralEinheiten(n: number): string {
  return `${n} Einheit${n === 1 ? '' : 'en'}`;
}

// ---- Modal state types ----------------------------------------------------
type HausModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; haus: HausRead };

type StockwerkModalState =
  | { mode: 'closed' }
  | { mode: 'create'; hausId: string }
  | { mode: 'edit'; stockwerk: StockwerkRead };

type EinheitModalState =
  | { mode: 'closed' }
  | { mode: 'create'; stockwerkId: string }
  | { mode: 'edit'; einheit: EinheitRead };

type ConfirmState =
  | { mode: 'closed' }
  | {
      mode: 'open';
      title: string;
      message: string;
      onConfirm: () => void;
    };

type ActiveNode =
  | { type: 'objekt' }
  | { type: 'haus'; id: string }
  | { type: 'stockwerk'; id: string }
  | { type: 'einheit'; id: string }
  | null;

export function ObjektStrukturEditor({
  objektId,
  objektAdresseId = null,
  onInteractionLockChange,
}: {
  objektId: string;
  objektAdresseId?: string | null;
  onInteractionLockChange?: (locked: boolean) => void;
}) {
  const qc = useQueryClient();

  const treeQuery = useQuery({
    queryKey: ['objekt-tree', objektId],
    queryFn: () => objektstrukturApi.listHaus(objektId),
    enabled: !!objektId,
  });

  // Objekt-Stammdaten (Wurzel-Knoten im Baum) — geteilter Cache mit Liste/Overlay.
  const objektQuery = useQuery({
    queryKey: ['objekt', objektId],
    queryFn: () => objektApi.get(objektId),
    enabled: !!objektId,
  });
  const objektMutation = useMutation({
    mutationFn: (patch: ObjektUpdate) => objektApi.update(objektId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['objekt', objektId], updated);
      qc.invalidateQueries({ queryKey: ['objekte'] });
      qc.invalidateQueries({ queryKey: ['tickets'] }); // Tickets betten Objektname ein
    },
  });
  const commitObjekt = (patch: ObjektUpdate) =>
    objektMutation.mutateAsync(patch).then(() => undefined);

  // Adressen für Haus-Adress-Picker
  const adressenQuery = useQuery({
    queryKey: ['adressen-for-haus'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const [openHaus, setOpenHaus] = useState<Record<string, boolean>>({});
  const [openStockwerk, setOpenStockwerk] = useState<Record<string, boolean>>({});
  const [activeNode, setActiveNode] = useState<ActiveNode>(null);

  // Modal states
  const [hausModal, setHausModal] = useState<HausModalState>({ mode: 'closed' });
  const [stockwerkModal, setStockwerkModal] = useState<StockwerkModalState>({
    mode: 'closed',
  });
  const [einheitModal, setEinheitModal] = useState<EinheitModalState>({
    mode: 'closed',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ mode: 'closed' });
  // Grundriss-Lösch-Confirm liegt tief im GrundrissPanel — wird für den
  // Interaction-Lock nach oben gemeldet.
  const [grundrissConfirmOpen, setGrundrissConfirmOpen] = useState(false);
  // Quick-Create-Modal im Beteiligten-Block sperrt ESC/Backdrop des Overlays.
  const [beteiligteModalOpen, setBeteiligteModalOpen] = useState(false);

  // Default: Objekt-Wurzel selektieren (zeigt die Objektdaten direkt), erstes Haus
  // aufklappen.
  useEffect(() => {
    if (activeNode === null) {
      setActiveNode({ type: 'objekt' });
    }
    const houses = treeQuery.data ?? [];
    if (houses.length > 0 && Object.keys(openHaus).length === 0) {
      setOpenHaus({ [houses[0]!.id]: true });
    }
  }, [treeQuery.data, openHaus, activeNode]);

  // ---- Interaction lock (ESC/Backdrop des Overlays sperren) ---------------
  const interactionLocked =
    hausModal.mode !== 'closed' ||
    stockwerkModal.mode !== 'closed' ||
    einheitModal.mode !== 'closed' ||
    confirmState.mode === 'open' ||
    grundrissConfirmOpen ||
    beteiligteModalOpen;
  useEffect(() => {
    onInteractionLockChange?.(interactionLocked);
  }, [interactionLocked, onInteractionLockChange]);
  // Beim Unmount (Reiter-Wechsel) Lock sicher lösen.
  useEffect(() => () => onInteractionLockChange?.(false), [onInteractionLockChange]);

  // ---- Mutations ---------------------------------------------------------
  const invalidateTree = () =>
    qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] });

  const createHaus = useMutation({
    mutationFn: (payload: {
      bezeichnung: string;
      notiz: string;
      adresse_id: string | null;
    }) =>
      objektstrukturApi.createHaus(objektId, {
        bezeichnung: payload.bezeichnung,
        notiz: payload.notiz || null,
        adresse_id: payload.adresse_id,
      }),
    onSuccess: (created) => {
      invalidateTree();
      setHausModal({ mode: 'closed' });
      setActiveNode({ type: 'haus', id: created.id });
    },
  });
  const updateHaus = useMutation({
    mutationFn: ({
      hausId,
      bezeichnung,
      notiz,
      adresse_id,
    }: {
      hausId: string;
      bezeichnung: string;
      notiz: string;
      adresse_id: string | null;
    }) =>
      objektstrukturApi.updateHaus(hausId, {
        bezeichnung,
        notiz: notiz || null,
        adresse_id,
      }),
    onSuccess: () => {
      invalidateTree();
      setHausModal({ mode: 'closed' });
    },
  });
  const removeHaus = useMutation({
    mutationFn: (hausId: string) => objektstrukturApi.removeHaus(hausId),
    onSuccess: (_data, hausId) => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
      if (activeNode?.type === 'haus' && activeNode.id === hausId) {
        setActiveNode(null);
      }
    },
  });

  const createStockwerk = useMutation({
    mutationFn: (vars: {
      hausId: string;
      bezeichnung: string;
      ausrichtung: Ausrichtung | null;
    }) =>
      objektstrukturApi.createStockwerk(vars.hausId, {
        bezeichnung: vars.bezeichnung,
        ausrichtung: vars.ausrichtung,
      }),
    onSuccess: (created) => {
      invalidateTree();
      setStockwerkModal({ mode: 'closed' });
      setActiveNode({ type: 'stockwerk', id: created.id });
    },
  });
  const updateStockwerk = useMutation({
    mutationFn: (vars: {
      swId: string;
      bezeichnung: string;
      ausrichtung: Ausrichtung | null;
    }) =>
      objektstrukturApi.updateStockwerk(vars.swId, {
        bezeichnung: vars.bezeichnung,
        ausrichtung: vars.ausrichtung,
      }),
    onSuccess: () => {
      invalidateTree();
      setStockwerkModal({ mode: 'closed' });
    },
  });
  const removeStockwerk = useMutation({
    mutationFn: (swId: string) => objektstrukturApi.removeStockwerk(swId),
    onSuccess: (_data, swId) => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
      if (activeNode?.type === 'stockwerk' && activeNode.id === swId) {
        setActiveNode(null);
      }
    },
  });

  const createEinheit = useMutation({
    mutationFn: (vars: {
      swId: string;
      bezeichnung: string;
      groesse_qm: number | null;
    }) =>
      objektstrukturApi.createEinheit(vars.swId, {
        bezeichnung: vars.bezeichnung,
        groesse_qm: vars.groesse_qm,
      }),
    onSuccess: (created) => {
      invalidateTree();
      setEinheitModal({ mode: 'closed' });
      setActiveNode({ type: 'einheit', id: created.id });
    },
  });
  const updateEinheit = useMutation({
    mutationFn: (vars: { eId: string; bezeichnung: string; groesse_qm: number | null }) =>
      objektstrukturApi.updateEinheit(vars.eId, {
        bezeichnung: vars.bezeichnung,
        groesse_qm: vars.groesse_qm,
      }),
    onSuccess: () => {
      invalidateTree();
      setEinheitModal({ mode: 'closed' });
    },
  });
  const removeEinheit = useMutation({
    mutationFn: (eId: string) => objektstrukturApi.removeEinheit(eId),
    onSuccess: (_data, eId) => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
      if (activeNode?.type === 'einheit' && activeNode.id === eId) {
        setActiveNode(null);
      }
    },
  });

  // Resolve active node to the underlying entity
  const activeEntity = useMemo(() => {
    if (!activeNode || !treeQuery.data) return null;
    for (const h of treeQuery.data) {
      if (activeNode.type === 'haus' && h.id === activeNode.id)
        return { type: 'haus' as const, haus: h };
      for (const s of h.stockwerke) {
        if (activeNode.type === 'stockwerk' && s.id === activeNode.id)
          return { type: 'stockwerk' as const, stockwerk: s, haus: h };
        for (const e of s.einheiten) {
          if (activeNode.type === 'einheit' && e.id === activeNode.id)
            return {
              type: 'einheit' as const,
              einheit: e,
              stockwerk: s,
              haus: h,
            };
        }
      }
    }
    return null;
  }, [activeNode, treeQuery.data]);

  // ---- Confirm-Dialog helpers --------------------------------------------
  function askConfirmRemoveHaus(haus: HausRead) {
    setConfirmState({
      mode: 'open',
      title: 'Haus löschen?',
      message: `Möchtest du das Haus „${haus.bezeichnung}" wirklich löschen?\nAlle Stockwerke und Einheiten darunter werden ebenfalls gelöscht.`,
      onConfirm: () => removeHaus.mutate(haus.id),
    });
  }
  function askConfirmRemoveStockwerk(sw: StockwerkRead) {
    setConfirmState({
      mode: 'open',
      title: 'Stockwerk löschen?',
      message: `Möchtest du das Stockwerk „${sw.bezeichnung}" wirklich löschen?\nAlle Einheiten darunter werden ebenfalls gelöscht.`,
      onConfirm: () => removeStockwerk.mutate(sw.id),
    });
  }
  function askConfirmRemoveEinheit(e: EinheitRead) {
    setConfirmState({
      mode: 'open',
      title: 'Einheit löschen?',
      message: `Möchtest du die Einheit „${e.bezeichnung}" wirklich löschen?`,
      onConfirm: () => removeEinheit.mutate(e.id),
    });
  }

  // ---- Modal submit handlers --------------------------------------------
  function handleHausSubmit(values: {
    bezeichnung: string;
    notiz: string;
    adresse_id: string | null;
  }) {
    if (hausModal.mode === 'edit') {
      updateHaus.mutate({
        hausId: hausModal.haus.id,
        bezeichnung: values.bezeichnung,
        notiz: values.notiz,
        adresse_id: values.adresse_id,
      });
    } else if (hausModal.mode === 'create') {
      createHaus.mutate(values);
    }
  }

  function handleStockwerkSubmit(values: {
    bezeichnung: string;
    ausrichtung: Ausrichtung | null;
  }) {
    if (stockwerkModal.mode === 'edit') {
      updateStockwerk.mutate({
        swId: stockwerkModal.stockwerk.id,
        bezeichnung: values.bezeichnung,
        ausrichtung: values.ausrichtung,
      });
    } else if (stockwerkModal.mode === 'create') {
      createStockwerk.mutate({
        hausId: stockwerkModal.hausId,
        bezeichnung: values.bezeichnung,
        ausrichtung: values.ausrichtung,
      });
    }
  }

  function handleEinheitSubmit(values: {
    bezeichnung: string;
    groesse_qm: number | null;
  }) {
    if (einheitModal.mode === 'edit') {
      updateEinheit.mutate({
        eId: einheitModal.einheit.id,
        bezeichnung: values.bezeichnung,
        groesse_qm: values.groesse_qm,
      });
    } else if (einheitModal.mode === 'create') {
      createEinheit.mutate({
        swId: einheitModal.stockwerkId,
        bezeichnung: values.bezeichnung,
        groesse_qm: values.groesse_qm,
      });
    }
  }

  const hausIsPending = createHaus.isPending || updateHaus.isPending;
  const stockwerkIsPending = createStockwerk.isPending || updateStockwerk.isPending;
  const einheitIsPending = createEinheit.isPending || updateEinheit.isPending;
  const confirmIsPending =
    removeHaus.isPending || removeStockwerk.isPending || removeEinheit.isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-end px-1 pb-3">
        <button
          type="button"
          onClick={() => setHausModal({ mode: 'create' })}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neues Haus
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Tree (left) — Objekt-Wurzel + Struktur */}
        <div className="min-h-0 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="space-y-2">
            {/* Objekt-Wurzel-Knoten — zeigt rechts die Objektdaten */}
            <button
              type="button"
              onClick={() => setActiveNode({ type: 'objekt' })}
              className={clsx(
                'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm font-semibold',
                activeNode?.type === 'objekt'
                  ? 'border-emerald-500/50 bg-emerald-500/5 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950/30 text-zinc-100',
              )}
            >
              <Landmark className="h-4 w-4 text-emerald-400" />
              <span className="flex-1 truncate">
                {objektQuery.data?.name ?? 'Objekt'}
              </span>
              <span className="text-[10px] font-normal text-zinc-500">Objekt</span>
            </button>

            {treeQuery.isLoading && (
              <div className="py-6 text-center text-sm text-zinc-500">
                Lade Struktur …
              </div>
            )}
            {treeQuery.data?.length === 0 && !treeQuery.isLoading && (
              <div className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center">
                <p className="text-xs text-zinc-400">Noch keine Häuser angelegt.</p>
                <button
                  type="button"
                  onClick={() => setHausModal({ mode: 'create' })}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Erstes Haus anlegen
                </button>
              </div>
            )}
            {treeQuery.data?.map((h) => (
              <HausNode
                key={h.id}
                haus={h}
                open={!!openHaus[h.id]}
                onToggle={() => setOpenHaus((s) => ({ ...s, [h.id]: !s[h.id] }))}
                isActive={activeNode?.type === 'haus' && activeNode.id === h.id}
                setActive={() => setActiveNode({ type: 'haus', id: h.id })}
                activeNode={activeNode}
                setActiveNode={setActiveNode}
                openStockwerk={openStockwerk}
                setOpenStockwerk={setOpenStockwerk}
                onAddStockwerk={() => setStockwerkModal({ mode: 'create', hausId: h.id })}
                onAddEinheit={(swId) =>
                  setEinheitModal({ mode: 'create', stockwerkId: swId })
                }
              />
            ))}
          </div>
        </div>

        {/* Detail panel (right) — sections */}
        <div className="min-h-0 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          {activeNode?.type === 'objekt' ? (
            <ObjektNodePanel
              objekt={objektQuery.data ?? null}
              loading={objektQuery.isLoading}
              onCommit={commitObjekt}
            />
          ) : activeEntity ? (
            <DetailPanel
              entity={activeEntity}
              objektId={objektId}
              adressen={adressenQuery.data?.items ?? []}
              objektAdresseId={objektAdresseId}
              onGrundrissConfirmChange={setGrundrissConfirmOpen}
              onBeteiligteLockChange={setBeteiligteModalOpen}
              onEditHaus={() =>
                activeEntity.type === 'haus'
                  ? setHausModal({ mode: 'edit', haus: activeEntity.haus })
                  : null
              }
              onEditStockwerk={() =>
                activeEntity.type === 'stockwerk'
                  ? setStockwerkModal({
                      mode: 'edit',
                      stockwerk: activeEntity.stockwerk,
                    })
                  : null
              }
              onEditEinheit={() =>
                activeEntity.type === 'einheit'
                  ? setEinheitModal({
                      mode: 'edit',
                      einheit: activeEntity.einheit,
                    })
                  : null
              }
              onRemoveHaus={() =>
                activeEntity.type === 'haus'
                  ? askConfirmRemoveHaus(activeEntity.haus)
                  : null
              }
              onRemoveStockwerk={() =>
                activeEntity.type === 'stockwerk'
                  ? askConfirmRemoveStockwerk(activeEntity.stockwerk)
                  : null
              }
              onRemoveEinheit={() =>
                activeEntity.type === 'einheit'
                  ? askConfirmRemoveEinheit(activeEntity.einheit)
                  : null
              }
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              <div className="text-center">
                <Layers className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
                Wähle links ein Haus, Stockwerk oder eine Einheit aus.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <HausModal
        open={hausModal.mode !== 'closed'}
        initial={
          hausModal.mode === 'edit'
            ? {
                bezeichnung: hausModal.haus.bezeichnung,
                notiz: hausModal.haus.notiz,
                adresse_id: hausModal.haus.adresse?.id ?? null,
              }
            : null
        }
        adressen={adressenQuery.data?.items ?? []}
        objektAdresseId={objektAdresseId}
        onClose={() => setHausModal({ mode: 'closed' })}
        onSubmit={handleHausSubmit}
        isPending={hausIsPending}
      />

      <StockwerkModal
        open={stockwerkModal.mode !== 'closed'}
        initial={
          stockwerkModal.mode === 'edit'
            ? {
                bezeichnung: stockwerkModal.stockwerk.bezeichnung,
                ausrichtung: stockwerkModal.stockwerk.ausrichtung,
              }
            : null
        }
        onClose={() => setStockwerkModal({ mode: 'closed' })}
        onSubmit={handleStockwerkSubmit}
        isPending={stockwerkIsPending}
      />

      <EinheitModal
        open={einheitModal.mode !== 'closed'}
        initial={
          einheitModal.mode === 'edit'
            ? {
                bezeichnung: einheitModal.einheit.bezeichnung,
                groesse_qm: einheitModal.einheit.groesse_qm,
              }
            : null
        }
        onClose={() => setEinheitModal({ mode: 'closed' })}
        onSubmit={handleEinheitSubmit}
        isPending={einheitIsPending}
      />

      <ConfirmDialog
        open={confirmState.mode === 'open'}
        title={confirmState.mode === 'open' ? confirmState.title : ''}
        message={confirmState.mode === 'open' ? confirmState.message : ''}
        tone="danger"
        confirmLabel="Löschen"
        onConfirm={() => {
          if (confirmState.mode === 'open') confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState({ mode: 'closed' })}
        busy={confirmIsPending}
      />
    </div>
  );
}

// ============================================================================
// Tree (pure structure, no badges, no inline actions — selection only)
// ============================================================================

interface HausNodeProps {
  haus: HausRead;
  open: boolean;
  onToggle: () => void;
  isActive: boolean;
  setActive: () => void;
  activeNode: ActiveNode;
  setActiveNode: (n: ActiveNode) => void;
  openStockwerk: Record<string, boolean>;
  setOpenStockwerk: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  onAddStockwerk: () => void;
  onAddEinheit: (swId: string) => void;
}

function HausNode({
  haus,
  open,
  onToggle,
  isActive,
  setActive,
  activeNode,
  setActiveNode,
  openStockwerk,
  setOpenStockwerk,
  onAddStockwerk,
  onAddEinheit,
}: HausNodeProps) {
  return (
    <div
      className={clsx(
        'group/haus rounded-md border bg-zinc-950/30',
        isActive ? 'border-emerald-500/50' : 'border-zinc-800',
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-2 px-2 py-2',
          isActive && 'bg-emerald-500/5',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-800"
          aria-label={open ? 'Zuklappen' : 'Aufklappen'}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={setActive}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-zinc-100"
        >
          <Building2 className="h-4 w-4 text-emerald-400" />
          {haus.bezeichnung}
          <span className="text-[10px] text-zinc-500">
            ({pluralStockwerke(haus.stockwerke.length)})
          </span>
        </button>
        <button
          type="button"
          onClick={onAddStockwerk}
          className="rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 group-hover/haus:opacity-100"
          title="Stockwerk hinzufügen"
          aria-label="Stockwerk hinzufügen"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="space-y-1 px-2 pb-2 pl-6">
          {haus.stockwerke.length === 0 ? (
            <div className="flex items-center justify-between py-1">
              <p className="text-xs text-zinc-500">Noch keine Stockwerke.</p>
              <button
                type="button"
                onClick={onAddStockwerk}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                <Plus className="h-3 w-3" /> Stockwerk anlegen
              </button>
            </div>
          ) : (
            haus.stockwerke.map((s) => (
              <StockwerkNode
                key={s.id}
                stockwerk={s}
                open={!!openStockwerk[s.id]}
                onToggle={() => setOpenStockwerk((st) => ({ ...st, [s.id]: !st[s.id] }))}
                isActive={activeNode?.type === 'stockwerk' && activeNode.id === s.id}
                setActive={() => setActiveNode({ type: 'stockwerk', id: s.id })}
                activeNode={activeNode}
                setActiveNode={setActiveNode}
                onAddEinheit={() => onAddEinheit(s.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface StockwerkNodeProps {
  stockwerk: StockwerkRead;
  open: boolean;
  onToggle: () => void;
  isActive: boolean;
  setActive: () => void;
  activeNode: ActiveNode;
  setActiveNode: (n: ActiveNode) => void;
  onAddEinheit: () => void;
}

function StockwerkNode({
  stockwerk,
  open,
  onToggle,
  isActive,
  setActive,
  activeNode,
  setActiveNode,
  onAddEinheit,
}: StockwerkNodeProps) {
  return (
    <div
      className={clsx(
        'group/sw rounded-md border bg-zinc-950/30',
        isActive ? 'border-emerald-500/50' : 'border-zinc-800',
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-2 px-2 py-1.5',
          isActive && 'bg-emerald-500/5',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-800"
          aria-label={open ? 'Zuklappen' : 'Aufklappen'}
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={setActive}
          className="flex flex-1 items-center gap-2 text-left text-sm text-zinc-200"
        >
          <Layers className="h-3.5 w-3.5 text-sky-400" />
          {stockwerk.bezeichnung}
          {stockwerk.ausrichtung && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              <Compass className="h-2.5 w-2.5" />{' '}
              {AUSRICHTUNG_LABEL[stockwerk.ausrichtung]}
            </span>
          )}
          {stockwerk.has_grundriss && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
              <ImageIcon className="h-2.5 w-2.5" />
            </span>
          )}
          <span className="text-[10px] text-zinc-500">
            ({pluralEinheiten(stockwerk.einheiten.length)})
          </span>
        </button>
        <button
          type="button"
          onClick={onAddEinheit}
          className="rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 group-hover/sw:opacity-100"
          title="Einheit hinzufügen"
          aria-label="Einheit hinzufügen"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="space-y-1 px-2 pb-2 pl-6">
          {stockwerk.einheiten.length === 0 ? (
            <div className="flex items-center justify-between py-1">
              <p className="text-xs text-zinc-500">Noch keine Einheiten.</p>
              <button
                type="button"
                onClick={onAddEinheit}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                <Plus className="h-3 w-3" /> Einheit anlegen
              </button>
            </div>
          ) : (
            stockwerk.einheiten.map((e) => (
              <EinheitNode
                key={e.id}
                einheit={e}
                isActive={activeNode?.type === 'einheit' && activeNode.id === e.id}
                setActive={() => setActiveNode({ type: 'einheit', id: e.id })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface EinheitNodeProps {
  einheit: EinheitRead;
  isActive: boolean;
  setActive: () => void;
}

function EinheitNode({ einheit, isActive, setActive }: EinheitNodeProps) {
  return (
    <button
      type="button"
      onClick={setActive}
      className={clsx(
        'flex w-full items-center gap-2 rounded-md border bg-zinc-950/20 px-2 py-1.5 text-left',
        isActive ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800',
      )}
    >
      <DoorOpen className="h-3.5 w-3.5 text-amber-400" />
      <span className="flex-1 text-sm text-zinc-200">{einheit.bezeichnung}</span>
      {einheit.groesse_qm != null && (
        <span className="text-[10px] text-zinc-500">{einheit.groesse_qm} m²</span>
      )}
    </button>
  );
}

// ============================================================================
// Objekt-Wurzel-Panel — Objektdaten (Name, Adresse, Notiz) inline editierbar
// ============================================================================

function ObjektNodePanel({
  objekt,
  loading,
  onCommit,
}: {
  objekt: ObjektRead | null;
  loading: boolean;
  onCommit: (patch: ObjektUpdate) => Promise<void>;
}) {
  const [historieOpen, setHistorieOpen] = useState(false);

  if (loading || !objekt) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        {loading ? 'Lade Objekt …' : 'Objekt nicht gefunden.'}
      </div>
    );
  }

  const adresseLabel = objekt.adresse
    ? `${objekt.adresse.strasse}${objekt.adresse.hausnummer ? ' ' + objekt.adresse.hausnummer : ''}, ${objekt.adresse.plz} ${objekt.adresse.ort}`
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Objekt</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <Landmark className="h-5 w-5 text-emerald-400" />
          {objekt.name}
        </h2>
      </div>

      {/* Grunddaten — inline editierbar */}
      <DetailSection title="Grunddaten">
        <div className="grid grid-cols-1 gap-3">
          <InlineEditText
            label="Name"
            value={objekt.name}
            required
            onCommit={(v) => onCommit({ name: v ?? '' })}
          />
          <div>
            <InlineEditEntity
              label="Adresse"
              value={objekt.adresse_id}
              displayLabel={adresseLabel}
              fetcher={searchAdressen}
              queryKey="objekt-node-adresse"
              placeholder="Adresse suchen …"
              onCommit={(v) => onCommit({ adresse_id: v })}
            />
            {objekt.adresse && (
              <MapsLink adresse={objekt.adresse} className="mt-1 px-1" />
            )}
          </div>
          <InlineEditText
            label="Notiz"
            value={objekt.notiz}
            multiline
            onCommit={(v) => onCommit({ notiz: v })}
          />
        </div>
      </DetailSection>

      {/* Historie — klein, eingeklappt */}
      <section className="rounded-md border border-zinc-800 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => setHistorieOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
        >
          {historieOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Historie
        </button>
        {historieOpen && (
          <dl className="grid grid-cols-1 gap-2 px-3 pb-3 text-sm md:grid-cols-2">
            <HistorieRow label="Angelegt am" value={fmtDateShort(objekt.created_at)} />
            <HistorieRow
              label="Zuletzt geändert am"
              value={fmtDateShort(objekt.updated_at)}
            />
            <HistorieRow label="Interne ID" value={objekt.id} />
          </dl>
        )}
      </section>
    </div>
  );
}

function HistorieRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="break-all text-zinc-300">
        {value || <span className="text-zinc-600">—</span>}
      </dd>
    </div>
  );
}

function fmtDateShort(s?: string | null): string | null {
  return s ? s.slice(0, 10).split('-').reverse().join('.') : null;
}

// ============================================================================
// Detail panel (sections for active node)
// ============================================================================

type ActiveEntity =
  | { type: 'haus'; haus: HausRead }
  | { type: 'stockwerk'; stockwerk: StockwerkRead; haus: HausRead }
  | {
      type: 'einheit';
      einheit: EinheitRead;
      stockwerk: StockwerkRead;
      haus: HausRead;
    };

interface DetailPanelProps {
  entity: ActiveEntity;
  objektId: string;
  adressen: AdresseRead[];
  objektAdresseId: string | null;
  onGrundrissConfirmChange: (open: boolean) => void;
  onBeteiligteLockChange: (open: boolean) => void;
  onEditHaus: () => void;
  onEditStockwerk: () => void;
  onEditEinheit: () => void;
  onRemoveHaus: () => void;
  onRemoveStockwerk: () => void;
  onRemoveEinheit: () => void;
}

function DetailPanel({
  entity,
  objektId,
  onGrundrissConfirmChange,
  onBeteiligteLockChange,
  onEditHaus,
  onEditStockwerk,
  onEditEinheit,
  onRemoveHaus,
  onRemoveStockwerk,
  onRemoveEinheit,
}: DetailPanelProps) {
  const qc = useQueryClient();
  const invalidateTree = () =>
    qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] });

  // Rollen für die Beteiligten-Liste (Auswahlliste `objekt_beteiligten_rolle`).
  const auswahllistenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
  });
  const rolleOptions = useMemo(() => {
    const liste = auswahllistenQuery.data?.find(
      (l) => l.key === 'objekt_beteiligten_rolle',
    );
    return aktiveWerte(liste?.werte).map((w) => ({ id: w.id, label: w.label }));
  }, [auswahllistenQuery.data]);

  // ---- Beteiligte: Voll-Replace pro Ebene (inline edit) ------------------
  const saveHausBeteiligte = useMutation({
    mutationFn: (vars: { hausId: string; beteiligte: BeteiligterWrite[] }) =>
      objektstrukturApi.updateHaus(vars.hausId, { beteiligte: vars.beteiligte }),
    onSuccess: invalidateTree,
  });
  const saveStockwerkBeteiligte = useMutation({
    mutationFn: (vars: { swId: string; beteiligte: BeteiligterWrite[] }) =>
      objektstrukturApi.updateStockwerk(vars.swId, { beteiligte: vars.beteiligte }),
    onSuccess: invalidateTree,
  });
  const saveEinheitBeteiligte = useMutation({
    mutationFn: (vars: { eId: string; beteiligte: BeteiligterWrite[] }) =>
      objektstrukturApi.updateEinheit(vars.eId, { beteiligte: vars.beteiligte }),
    onSuccess: invalidateTree,
  });

  function saveBeteiligte(next: BeteiligterWrite[]) {
    if (entity.type === 'haus') {
      saveHausBeteiligte.mutate({ hausId: entity.haus.id, beteiligte: next });
    } else if (entity.type === 'stockwerk') {
      saveStockwerkBeteiligte.mutate({ swId: entity.stockwerk.id, beteiligte: next });
    } else {
      saveEinheitBeteiligte.mutate({ eId: entity.einheit.id, beteiligte: next });
    }
  }

  const beteiligte =
    entity.type === 'haus'
      ? entity.haus.beteiligte
      : entity.type === 'stockwerk'
        ? entity.stockwerk.beteiligte
        : entity.einheit.beteiligte;

  // Determine props depending on entity type
  let title: string;
  let subtitle: string;
  let icon: typeof Building2;
  let iconColor: string;
  let onEdit: () => void;
  let onRemove: () => void;
  let grunddaten: Array<{ label: string; value: string | null | undefined }>;
  let showGrundriss = false;
  let stockwerkForGrundriss: StockwerkRead | null = null;

  if (entity.type === 'haus') {
    const h = entity.haus;
    title = h.bezeichnung;
    subtitle = 'Haus';
    icon = Building2;
    iconColor = 'text-emerald-400';
    onEdit = onEditHaus;
    onRemove = onRemoveHaus;
    const adresse = h.adresse
      ? `${h.adresse.strasse}${h.adresse.hausnummer ? ' ' + h.adresse.hausnummer : ''}, ${h.adresse.plz} ${h.adresse.ort}`
      : '— (verwendet Objekt-Adresse)';
    grunddaten = [
      { label: 'Adresse', value: adresse },
      { label: 'Notiz', value: h.notiz },
    ];
  } else if (entity.type === 'stockwerk') {
    const s = entity.stockwerk;
    title = s.bezeichnung;
    subtitle = `Stockwerk · ${entity.haus.bezeichnung}`;
    icon = Layers;
    iconColor = 'text-sky-400';
    onEdit = onEditStockwerk;
    onRemove = onRemoveStockwerk;
    grunddaten = [
      {
        label: 'Ausrichtung',
        value: s.ausrichtung ? AUSRICHTUNG_LABEL[s.ausrichtung] : null,
      },
      { label: 'Einheiten', value: pluralEinheiten(s.einheiten.length) },
    ];
    showGrundriss = true;
    stockwerkForGrundriss = s;
  } else {
    const e = entity.einheit;
    title = e.bezeichnung;
    subtitle = `Einheit · ${entity.haus.bezeichnung} → ${entity.stockwerk.bezeichnung}`;
    icon = DoorOpen;
    iconColor = 'text-amber-400';
    onEdit = onEditEinheit;
    onRemove = onRemoveEinheit;
    grunddaten = [
      {
        label: 'Größe',
        value: e.groesse_qm != null ? `${e.groesse_qm} m²` : null,
      },
    ];
    // Grundriss vom übergeordneten Stockwerk anzeigen (Vererbung, read-only)
    if (entity.stockwerk.has_grundriss) {
      showGrundriss = true;
      stockwerkForGrundriss = entity.stockwerk;
    }
  }

  const Icon = icon;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">{subtitle}</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Icon className={clsx('h-5 w-5', iconColor)} />
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <Pencil className="h-3 w-3" /> Bearbeiten
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" /> Löschen
          </button>
        </div>
      </div>

      {/* Grunddaten */}
      <DetailSection title="Grunddaten">
        <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          {grunddaten.map((row) => (
            <div key={row.label} className="flex flex-col">
              <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
                {row.label}
              </dt>
              <dd className="text-zinc-200">
                {row.value || <span className="text-zinc-600">— nicht gesetzt —</span>}
              </dd>
            </div>
          ))}
        </dl>
      </DetailSection>

      {/* Beteiligte (Partner + freie Rolle) — ersetzt Eigentümer/Mieter */}
      <DetailSection title="Beteiligte" icon={Users2}>
        <StrukturBeteiligteBlock
          beteiligte={beteiligte}
          rolleOptions={rolleOptions}
          onChange={saveBeteiligte}
          onInteractionLockChange={onBeteiligteLockChange}
        />
      </DetailSection>

      {/* Grundriss */}
      {showGrundriss && stockwerkForGrundriss && (
        <DetailSection
          title={
            entity.type === 'einheit'
              ? `Grundriss (aus Stockwerk „${entity.stockwerk.bezeichnung}")`
              : 'Grundriss'
          }
        >
          <GrundrissPanel
            stockwerk={stockwerkForGrundriss}
            objektId={objektId}
            readOnly={entity.type === 'einheit'}
            onConfirmOpenChange={onGrundrissConfirmChange}
          />
        </DetailSection>
      )}

      {/* Dokumente — Placeholder */}
      <DetailSection title="Dokumente" icon={FileText}>
        <p className="text-xs text-zinc-500">
          Verknüpfte Dokumente folgen — heute sind Dokumente nur an Objekt-Ebene
          anhängbar, nicht an Haus / Stockwerk / Einheit.
        </p>
      </DetailSection>
    </div>
  );
}

interface DetailSectionProps {
  title: string;
  icon?: typeof FileText;
  children: React.ReactNode;
}

function DetailSection({ title, icon: Icon, children }: DetailSectionProps) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {Icon && <Icon className="h-3 w-3" />} {title}
      </h3>
      {children}
    </section>
  );
}

// ============================================================================
// Grundriss panel (existing logic, unchanged)
// ============================================================================

function GrundrissPanel({
  stockwerk,
  objektId,
  readOnly = false,
  onConfirmOpenChange,
}: {
  stockwerk: StockwerkRead;
  objektId: string;
  readOnly?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lösch-Confirm nach oben melden (Interaction-Lock fürs Overlay).
  useEffect(() => {
    onConfirmOpenChange?.(confirmDelete);
  }, [confirmDelete, onConfirmOpenChange]);
  useEffect(() => () => onConfirmOpenChange?.(false), [onConfirmOpenChange]);

  useEffect(() => {
    if (!stockwerk.has_grundriss) {
      setBlobUrl(null);
      return;
    }
    let canceled = false;
    let url: string | null = null;
    (async () => {
      try {
        const blob = await api
          .get<Blob>(`/objektstruktur/stockwerke/${stockwerk.id}/grundriss/file`, {
            responseType: 'blob',
          })
          .then((r) => r.data);
        if (!canceled) {
          url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      canceled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stockwerk.id, stockwerk.has_grundriss]);

  const upload = useMutation({
    mutationFn: (file: File) => objektstrukturApi.uploadGrundriss(stockwerk.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });

  const deleteGrundriss = useMutation({
    mutationFn: () => objektstrukturApi.deleteGrundriss(stockwerk.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] });
      setConfirmDelete(false);
    },
  });

  return (
    <div>
      {!readOnly && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />{' '}
            {upload.isPending
              ? 'lädt …'
              : stockwerk.has_grundriss
                ? 'Ersetzen'
                : 'Hochladen'}
          </button>
          {stockwerk.has_grundriss && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteGrundriss.isPending}
              className="flex items-center gap-1.5 rounded-md border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              title="Grundriss entfernen"
            >
              <Trash2 className="h-3 w-3" />{' '}
              {deleteGrundriss.isPending ? 'lösche …' : 'Löschen'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {blobUrl ? (
        stockwerk.grundriss_mime === 'application/pdf' ? (
          <iframe
            title="Grundriss"
            src={blobUrl}
            className="h-96 w-full rounded-md border border-zinc-800 bg-zinc-950"
          />
        ) : (
          <img
            src={blobUrl}
            alt="Grundriss"
            className="max-h-96 w-full rounded-md border border-zinc-800 bg-zinc-950 object-contain"
          />
        )
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/30 text-sm text-zinc-500">
          <div className="text-center">
            <ImageIcon className="mx-auto mb-2 h-6 w-6 text-zinc-700" />
            Noch kein Grundriss hinterlegt.
            <div className="text-[10px]">PNG / JPG / WEBP / PDF, max 10 MB</div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Grundriss löschen?"
        message={`Möchtest du den Grundriss für „${stockwerk.bezeichnung}" wirklich löschen?`}
        tone="danger"
        confirmLabel="Löschen"
        onConfirm={() => deleteGrundriss.mutate()}
        onCancel={() => setConfirmDelete(false)}
        busy={deleteGrundriss.isPending}
      />
    </div>
  );
}
