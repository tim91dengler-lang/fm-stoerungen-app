import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  Crown,
  DoorOpen,
  FileText,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import { adresseApi, objektApi, objektstrukturApi } from '../api/endpoints';
import type {
  Ausrichtung,
  HausRead,
  StockwerkRead,
  EinheitRead,
  PartnerMini,
} from '../api/types';
import { HausModal } from '../components/HausModal';
import { StockwerkModal } from '../components/StockwerkModal';
import { EinheitModal } from '../components/EinheitModal';
import { PartnerSearchSelect } from '../components/PartnerSearchSelect';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

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
  | { type: 'haus'; id: string }
  | { type: 'stockwerk'; id: string }
  | { type: 'einheit'; id: string }
  | null;

export function ObjektDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const objektId = id ?? '';

  const objektQuery = useQuery({
    queryKey: ['objekt', objektId],
    queryFn: () => objektApi.get(objektId),
    enabled: !!objektId,
  });

  const treeQuery = useQuery({
    queryKey: ['objekt-tree', objektId],
    queryFn: () => objektstrukturApi.listHaus(objektId),
    enabled: !!objektId,
  });

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

  // Default: open first house, select it
  useEffect(() => {
    const houses = treeQuery.data ?? [];
    if (houses.length > 0 && Object.keys(openHaus).length === 0) {
      setOpenHaus({ [houses[0]!.id]: true });
      if (!activeNode) {
        setActiveNode({ type: 'haus', id: houses[0]!.id });
      }
    }
  }, [treeQuery.data, openHaus, activeNode]);

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
    mutationFn: (vars: {
      eId: string;
      bezeichnung: string;
      groesse_qm: number | null;
    }) =>
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

  // Eigentümer auf Objekt-Ebene (aus partner_links extrahiert)
  const eigentuemer = useMemo(
    () =>
      (objektQuery.data?.partner_links ?? []).filter(
        (l) => l.rolle === 'eigentuemer',
      ),
    [objektQuery.data],
  );

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

  if (!objektId)
    return <div className="p-6 text-sm text-zinc-500">Kein Objekt ausgewählt.</div>;

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
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/stammdaten/objekte"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Objekte
          </Link>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Building2 className="h-5 w-5 text-emerald-400" />
            {objektQuery.data?.name ?? '…'}
          </h1>
          {objektQuery.data?.adresse && (
            <p className="text-xs text-zinc-500">
              {objektQuery.data.adresse.strasse} {objektQuery.data.adresse.hausnummer}, {objektQuery.data.adresse.plz}{' '}
              {objektQuery.data.adresse.ort}
            </p>
          )}
          {eigentuemer.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                <Crown className="h-3 w-3" /> Eigentümer (Objekt)
              </span>
              {eigentuemer.map((p) => (
                <span
                  key={p.partner_id}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300"
                  title={`Eigentümer: ${p.partner_name}`}
                >
                  {p.partner_name}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHausModal({ mode: 'create' })}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neues Haus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Tree (left) — pure structure, no badges */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          {treeQuery.isLoading && (
            <div className="py-8 text-center text-sm text-zinc-500">Lade Struktur …</div>
          )}
          {treeQuery.data?.length === 0 && (
            <div className="py-8 text-center">
              <Building2 className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-400">Noch keine Häuser angelegt.</p>
              <button
                type="button"
                onClick={() => setHausModal({ mode: 'create' })}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                <Plus className="h-3.5 w-3.5" /> Erstes Haus anlegen
              </button>
            </div>
          )}
          <div className="space-y-2">
            {treeQuery.data?.map((h) => (
              <HausNode
                key={h.id}
                haus={h}
                open={!!openHaus[h.id]}
                onToggle={() => setOpenHaus((s) => ({ ...s, [h.id]: !s[h.id] }))}
                isActive={
                  activeNode?.type === 'haus' && activeNode.id === h.id
                }
                setActive={() => setActiveNode({ type: 'haus', id: h.id })}
                activeNode={activeNode}
                setActiveNode={setActiveNode}
                openStockwerk={openStockwerk}
                setOpenStockwerk={setOpenStockwerk}
                onAddStockwerk={() =>
                  setStockwerkModal({ mode: 'create', hausId: h.id })
                }
                onAddEinheit={(swId) =>
                  setEinheitModal({ mode: 'create', stockwerkId: swId })
                }
              />
            ))}
          </div>
        </div>

        {/* Detail panel (right) — sections */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          {activeEntity ? (
            <DetailPanel
              entity={activeEntity}
              objektId={objektId}
              adressen={adressenQuery.data?.items ?? []}
              objektAdresseId={objektQuery.data?.adresse_id ?? null}
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
        objektAdresseId={objektQuery.data?.adresse_id ?? null}
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
                onToggle={() =>
                  setOpenStockwerk((st) => ({ ...st, [s.id]: !st[s.id] }))
                }
                isActive={
                  activeNode?.type === 'stockwerk' && activeNode.id === s.id
                }
                setActive={() =>
                  setActiveNode({ type: 'stockwerk', id: s.id })
                }
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
                isActive={
                  activeNode?.type === 'einheit' && activeNode.id === e.id
                }
                setActive={() =>
                  setActiveNode({ type: 'einheit', id: e.id })
                }
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
  adressen: import('../api/types').AdresseRead[];
  objektAdresseId: string | null;
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

  // ---- mutations for partner relations (inline edit) ---------------------
  const updateHausPartner = useMutation({
    mutationFn: (vars: {
      hausId: string;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateHaus(vars.hausId, {
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: invalidateTree,
  });
  const updateStockwerkPartner = useMutation({
    mutationFn: (vars: {
      swId: string;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateStockwerk(vars.swId, {
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: invalidateTree,
  });
  const updateEinheitPartner = useMutation({
    mutationFn: (vars: {
      eId: string;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateEinheit(vars.eId, {
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: invalidateTree,
  });

  // Determine props depending on entity type
  let title: string;
  let subtitle: string;
  let icon: typeof Building2;
  let iconColor: string;
  let onEdit: () => void;
  let onRemove: () => void;
  let eigentuemer: PartnerMini[];
  let mieter: PartnerMini[];
  let savePartners: (eig: PartnerMini[], mie: PartnerMini[]) => void;
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
    eigentuemer = h.eigentuemer;
    mieter = h.mieter;
    savePartners = (eig, mie) =>
      updateHausPartner.mutate({
        hausId: h.id,
        eigentuemer_ids: eig.map((p) => p.id),
        mieter_ids: mie.map((p) => p.id),
      });
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
    eigentuemer = s.eigentuemer;
    mieter = s.mieter;
    savePartners = (eig, mie) =>
      updateStockwerkPartner.mutate({
        swId: s.id,
        eigentuemer_ids: eig.map((p) => p.id),
        mieter_ids: mie.map((p) => p.id),
      });
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
    eigentuemer = e.eigentuemer;
    mieter = e.mieter;
    savePartners = (eig, mie) =>
      updateEinheitPartner.mutate({
        eId: e.id,
        eigentuemer_ids: eig.map((p) => p.id),
        mieter_ids: mie.map((p) => p.id),
      });
    grunddaten = [
      {
        label: 'Größe',
        value: e.groesse_qm != null ? `${e.groesse_qm} m²` : null,
      },
    ];
  }

  const Icon = icon;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            {subtitle}
          </p>
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
                {row.value || (
                  <span className="text-zinc-600">— nicht gesetzt —</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </DetailSection>

      {/* Eigentümer */}
      <DetailSection title="Eigentümer">
        <PartnerSearchSelect
          selected={eigentuemer}
          onChange={(next) => savePartners(next, mieter)}
          roleLabel="Eigentümer"
          tone="violet"
          searchPlaceholder="Eigentümer suchen … (alle Partner)"
        />
      </DetailSection>

      {/* Mieter */}
      <DetailSection title="Mieter">
        <PartnerSearchSelect
          selected={mieter}
          onChange={(next) => savePartners(eigentuemer, next)}
          roleLabel="Mieter"
          tone="amber"
          searchPlaceholder="Mieter suchen … (alle Partner)"
        />
      </DetailSection>

      {/* Grundriss (nur Stockwerk) */}
      {showGrundriss && stockwerkForGrundriss && (
        <DetailSection title="Grundriss">
          <GrundrissPanel stockwerk={stockwerkForGrundriss} objektId={objektId} />
        </DetailSection>
      )}

      {/* Dokumente — Placeholder */}
      <DetailSection title="Dokumente" icon={FileText}>
        <p className="text-xs text-zinc-500">
          Verknüpfte Dokumente folgen — heute sind Dokumente nur an
          Objekt-Ebene anhängbar, nicht an Haus / Stockwerk / Einheit.
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
}: {
  stockwerk: StockwerkRead;
  objektId: string;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    mutationFn: (file: File) =>
      objektstrukturApi.uploadGrundriss(stockwerk.id, file),
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
