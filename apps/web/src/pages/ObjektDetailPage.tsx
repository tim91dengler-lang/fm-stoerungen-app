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
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import {
  adresseApi,
  objektApi,
  objektstrukturApi,
  partnerApi,
} from '../api/endpoints';
import type {
  Ausrichtung,
  HausRead,
  StockwerkRead,
  EinheitRead,
  PartnerMini,
  PartnerRead,
} from '../api/types';
import { HausModal } from '../components/HausModal';
import { StockwerkModal } from '../components/StockwerkModal';
import { EinheitModal } from '../components/EinheitModal';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

const AUSRICHTUNG_LABEL: Record<Ausrichtung, string> = {
  nord: '⬆ Nord',
  ost: '➡ Ost',
  sued: '⬇ Süd',
  west: '⬅ West',
};

// Pluralisation helpers — kept inline since this is the only place we need them
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

  const partnerQuery = useQuery({
    queryKey: ['partner-all'],
    queryFn: () => partnerApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  // Adressen für Haus-Adress-Picker (Tim R4): Häuser können eine eigene
  // Adresse abweichend vom Objekt haben (z. B. großes Grundstück).
  const adressenQuery = useQuery({
    queryKey: ['adressen-for-haus'],
    queryFn: () => adresseApi.list({ limit: 500 }),
    staleTime: 60_000,
  });

  const [openHaus, setOpenHaus] = useState<Record<string, boolean>>({});
  const [openStockwerk, setOpenStockwerk] = useState<Record<string, boolean>>({});
  const [activeStockwerkId, setActiveStockwerkId] = useState<string | null>(null);

  // Modal states
  const [hausModal, setHausModal] = useState<HausModalState>({ mode: 'closed' });
  const [stockwerkModal, setStockwerkModal] = useState<StockwerkModalState>({
    mode: 'closed',
  });
  const [einheitModal, setEinheitModal] = useState<EinheitModalState>({
    mode: 'closed',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ mode: 'closed' });

  // Default: open the first house
  useEffect(() => {
    const houses = treeQuery.data ?? [];
    if (houses.length > 0 && Object.keys(openHaus).length === 0) {
      setOpenHaus({ [houses[0]!.id]: true });
    }
  }, [treeQuery.data, openHaus]);

  // ---- Mutations ---------------------------------------------------------
  const invalidateTree = () =>
    qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] });

  const createHaus = useMutation({
    mutationFn: (payload: {
      bezeichnung: string;
      notiz: string;
      adresse_id: string | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.createHaus(objektId, {
        bezeichnung: payload.bezeichnung,
        notiz: payload.notiz || null,
        adresse_id: payload.adresse_id,
        eigentuemer_ids: payload.eigentuemer_ids,
        mieter_ids: payload.mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setHausModal({ mode: 'closed' });
    },
  });
  const updateHaus = useMutation({
    mutationFn: ({
      hausId,
      bezeichnung,
      notiz,
      adresse_id,
      eigentuemer_ids,
      mieter_ids,
    }: {
      hausId: string;
      bezeichnung: string;
      notiz: string;
      adresse_id: string | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateHaus(hausId, {
        bezeichnung,
        notiz: notiz || null,
        adresse_id,
        eigentuemer_ids,
        mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setHausModal({ mode: 'closed' });
    },
  });
  const removeHaus = useMutation({
    mutationFn: (hausId: string) => objektstrukturApi.removeHaus(hausId),
    onSuccess: () => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
    },
  });

  const createStockwerk = useMutation({
    mutationFn: (vars: {
      hausId: string;
      bezeichnung: string;
      ausrichtung: Ausrichtung | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.createStockwerk(vars.hausId, {
        bezeichnung: vars.bezeichnung,
        ausrichtung: vars.ausrichtung,
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setStockwerkModal({ mode: 'closed' });
    },
  });
  const updateStockwerk = useMutation({
    mutationFn: (vars: {
      swId: string;
      bezeichnung: string;
      ausrichtung: Ausrichtung | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateStockwerk(vars.swId, {
        bezeichnung: vars.bezeichnung,
        ausrichtung: vars.ausrichtung,
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setStockwerkModal({ mode: 'closed' });
    },
  });
  const removeStockwerk = useMutation({
    mutationFn: (swId: string) => objektstrukturApi.removeStockwerk(swId),
    onSuccess: () => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
    },
  });

  const createEinheit = useMutation({
    mutationFn: (vars: {
      swId: string;
      bezeichnung: string;
      groesse_qm: number | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.createEinheit(vars.swId, {
        bezeichnung: vars.bezeichnung,
        groesse_qm: vars.groesse_qm,
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setEinheitModal({ mode: 'closed' });
    },
  });
  const updateEinheit = useMutation({
    mutationFn: (vars: {
      eId: string;
      bezeichnung: string;
      groesse_qm: number | null;
      eigentuemer_ids: string[];
      mieter_ids: string[];
    }) =>
      objektstrukturApi.updateEinheit(vars.eId, {
        bezeichnung: vars.bezeichnung,
        groesse_qm: vars.groesse_qm,
        eigentuemer_ids: vars.eigentuemer_ids,
        mieter_ids: vars.mieter_ids,
      }),
    onSuccess: () => {
      invalidateTree();
      setEinheitModal({ mode: 'closed' });
    },
  });
  const removeEinheit = useMutation({
    mutationFn: (eId: string) => objektstrukturApi.removeEinheit(eId),
    onSuccess: () => {
      invalidateTree();
      setConfirmState({ mode: 'closed' });
    },
  });

  const allPartner = partnerQuery.data?.items ?? [];

  const stockwerke = (treeQuery.data ?? []).flatMap((h) => h.stockwerke);
  const activeStockwerk = activeStockwerkId
    ? stockwerke.find((s) => s.id === activeStockwerkId) ?? null
    : null;

  // Eigentümer aus partner_links extrahieren (Rolle === 'eigentuemer')
  const eigentuemer = useMemo(
    () =>
      (objektQuery.data?.partner_links ?? []).filter(
        (l) => l.rolle === 'eigentuemer',
      ),
    [objektQuery.data],
  );

  if (!objektId) return <div className="p-6 text-sm text-zinc-500">Kein Objekt ausgewählt.</div>;

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
    eigentuemer_ids: string[];
    mieter_ids: string[];
  }) {
    if (hausModal.mode === 'edit') {
      updateHaus.mutate({
        hausId: hausModal.haus.id,
        bezeichnung: values.bezeichnung,
        notiz: values.notiz,
        adresse_id: values.adresse_id,
        eigentuemer_ids: values.eigentuemer_ids,
        mieter_ids: values.mieter_ids,
      });
    } else if (hausModal.mode === 'create') {
      createHaus.mutate(values);
    }
  }

  function handleStockwerkSubmit(values: {
    bezeichnung: string;
    ausrichtung: Ausrichtung | null;
    eigentuemer_ids: string[];
    mieter_ids: string[];
  }) {
    if (stockwerkModal.mode === 'edit') {
      updateStockwerk.mutate({
        swId: stockwerkModal.stockwerk.id,
        bezeichnung: values.bezeichnung,
        ausrichtung: values.ausrichtung,
        eigentuemer_ids: values.eigentuemer_ids,
        mieter_ids: values.mieter_ids,
      });
    } else if (stockwerkModal.mode === 'create') {
      createStockwerk.mutate({
        hausId: stockwerkModal.hausId,
        bezeichnung: values.bezeichnung,
        ausrichtung: values.ausrichtung,
        eigentuemer_ids: values.eigentuemer_ids,
        mieter_ids: values.mieter_ids,
      });
    }
  }

  function handleEinheitSubmit(values: {
    bezeichnung: string;
    groesse_qm: number | null;
    eigentuemer_ids: string[];
    mieter_ids: string[];
  }) {
    if (einheitModal.mode === 'edit') {
      updateEinheit.mutate({
        eId: einheitModal.einheit.id,
        bezeichnung: values.bezeichnung,
        groesse_qm: values.groesse_qm,
        eigentuemer_ids: values.eigentuemer_ids,
        mieter_ids: values.mieter_ids,
      });
    } else if (einheitModal.mode === 'create') {
      createEinheit.mutate({
        swId: einheitModal.stockwerkId,
        bezeichnung: values.bezeichnung,
        groesse_qm: values.groesse_qm,
        eigentuemer_ids: values.eigentuemer_ids,
        mieter_ids: values.mieter_ids,
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
                <Crown className="h-3 w-3" /> Eigentümer
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tree (left) */}
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
                openStockwerk={openStockwerk}
                setOpenStockwerk={setOpenStockwerk}
                activeStockwerkId={activeStockwerkId}
                setActiveStockwerkId={setActiveStockwerkId}
                onEditHaus={() => setHausModal({ mode: 'edit', haus: h })}
                onRemoveHaus={() => askConfirmRemoveHaus(h)}
                onAddStockwerk={() =>
                  setStockwerkModal({ mode: 'create', hausId: h.id })
                }
                onEditStockwerk={(sw) =>
                  setStockwerkModal({ mode: 'edit', stockwerk: sw })
                }
                onRemoveStockwerk={askConfirmRemoveStockwerk}
                onAddEinheit={(swId) =>
                  setEinheitModal({ mode: 'create', stockwerkId: swId })
                }
                onEditEinheit={(e) => setEinheitModal({ mode: 'edit', einheit: e })}
                onRemoveEinheit={askConfirmRemoveEinheit}
                allPartner={allPartner}
              />
            ))}
          </div>
        </div>

        {/* Grundriss panel (right) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          {activeStockwerk ? (
            <GrundrissPanel stockwerk={activeStockwerk} objektId={objektId} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              <div className="text-center">
                <Layers className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
                Wähle ein Stockwerk links für Grundriss-Vorschau und Upload.
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
                eigentuemer_ids: hausModal.haus.eigentuemer.map((p) => p.id),
                mieter_ids: hausModal.haus.mieter.map((p) => p.id),
              }
            : null
        }
        adressen={adressenQuery.data?.items ?? []}
        objektAdresseId={objektQuery.data?.adresse_id ?? null}
        partner={allPartner}
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
                eigentuemer_ids: stockwerkModal.stockwerk.eigentuemer.map(
                  (p) => p.id,
                ),
                mieter_ids: stockwerkModal.stockwerk.mieter.map((p) => p.id),
              }
            : null
        }
        partner={allPartner}
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
                eigentuemer_ids: einheitModal.einheit.eigentuemer.map((p) => p.id),
                mieter_ids: einheitModal.einheit.mieter.map((m) => m.id),
              }
            : null
        }
        partner={allPartner}
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
// Tree nodes
// ============================================================================

interface HausNodeProps {
  haus: HausRead;
  open: boolean;
  onToggle: () => void;
  openStockwerk: Record<string, boolean>;
  setOpenStockwerk: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  activeStockwerkId: string | null;
  setActiveStockwerkId: (id: string | null) => void;
  onEditHaus: () => void;
  onRemoveHaus: () => void;
  onAddStockwerk: () => void;
  onEditStockwerk: (sw: StockwerkRead) => void;
  onRemoveStockwerk: (sw: StockwerkRead) => void;
  onAddEinheit: (swId: string) => void;
  onEditEinheit: (e: EinheitRead) => void;
  onRemoveEinheit: (e: EinheitRead) => void;
  allPartner: PartnerRead[];
}

function HausNode({
  haus,
  open,
  onToggle,
  openStockwerk,
  setOpenStockwerk,
  activeStockwerkId,
  setActiveStockwerkId,
  onEditHaus,
  onRemoveHaus,
  onAddStockwerk,
  onEditStockwerk,
  onRemoveStockwerk,
  onAddEinheit,
  onEditEinheit,
  onRemoveEinheit,
  allPartner,
}: HausNodeProps) {
  return (
    <div className="group/haus rounded-md border border-zinc-800 bg-zinc-950/30">
      <div className="flex flex-wrap items-center gap-2 px-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-zinc-100"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <Building2 className="h-4 w-4 text-emerald-400" /> {haus.bezeichnung}
          <span className="text-[10px] text-zinc-500">
            ({pluralStockwerke(haus.stockwerke.length)})
          </span>
        </button>
        <PartnerBadges
          eigentuemer={haus.eigentuemer}
          mieter={haus.mieter}
        />
        {/* Hover-only action icons */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/haus:opacity-100">
          <button
            type="button"
            onClick={onAddStockwerk}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Stockwerk hinzufügen"
            aria-label="Stockwerk hinzufügen"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEditHaus}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Haus bearbeiten"
            aria-label="Haus bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemoveHaus}
            className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
            title="Haus löschen"
            aria-label="Haus löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
                isActive={activeStockwerkId === s.id}
                setActive={() => setActiveStockwerkId(s.id)}
                onEdit={() => onEditStockwerk(s)}
                onRemove={() => onRemoveStockwerk(s)}
                onAddEinheit={() => onAddEinheit(s.id)}
                onEditEinheit={onEditEinheit}
                onRemoveEinheit={onRemoveEinheit}
                allPartner={allPartner}
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
  onEdit: () => void;
  onRemove: () => void;
  onAddEinheit: () => void;
  onEditEinheit: (e: EinheitRead) => void;
  onRemoveEinheit: (e: EinheitRead) => void;
  allPartner: PartnerRead[];
}

function StockwerkNode({
  stockwerk,
  open,
  onToggle,
  isActive,
  setActive,
  onEdit,
  onRemove,
  onAddEinheit,
  onEditEinheit,
  onRemoveEinheit,
}: StockwerkNodeProps) {
  return (
    <div
      className={clsx(
        'group/sw rounded-md border bg-zinc-950/30',
        isActive ? 'border-emerald-500/40' : 'border-zinc-800',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left text-sm text-zinc-200"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Layers className="h-3.5 w-3.5 text-sky-400" /> {stockwerk.bezeichnung}
          {stockwerk.ausrichtung && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              <Compass className="h-2.5 w-2.5" /> {AUSRICHTUNG_LABEL[stockwerk.ausrichtung]}
            </span>
          )}
          {stockwerk.has_grundriss && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
              <ImageIcon className="h-2.5 w-2.5" /> Grundriss
            </span>
          )}
          <span className="text-[10px] text-zinc-500">
            ({pluralEinheiten(stockwerk.einheiten.length)})
          </span>
        </button>
        <PartnerBadges
          eigentuemer={stockwerk.eigentuemer}
          mieter={stockwerk.mieter}
        />
        <button
          type="button"
          onClick={setActive}
          className={clsx(
            'rounded-md p-1 hover:bg-zinc-800',
            isActive ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200',
          )}
          title="Grundriss anzeigen"
          aria-label="Grundriss anzeigen"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        {/* Hover-only action icons */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/sw:opacity-100">
          <button
            type="button"
            onClick={onAddEinheit}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Einheit hinzufügen"
            aria-label="Einheit hinzufügen"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Stockwerk bearbeiten"
            aria-label="Stockwerk bearbeiten"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
            title="Stockwerk löschen"
            aria-label="Stockwerk löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
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
                onEdit={() => onEditEinheit(e)}
                onRemove={() => onRemoveEinheit(e)}
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
  onEdit: () => void;
  onRemove: () => void;
}

function EinheitNode({ einheit, onEdit, onRemove }: EinheitNodeProps) {
  return (
    <div className="group/e rounded-md border border-zinc-800 bg-zinc-950/20">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <DoorOpen className="h-3.5 w-3.5 text-amber-400" />
        <span className="flex-1 text-sm text-zinc-200">{einheit.bezeichnung}</span>
        {einheit.groesse_qm != null && (
          <span className="text-[10px] text-zinc-500">{einheit.groesse_qm} m²</span>
        )}
        <PartnerBadges
          eigentuemer={einheit.eigentuemer}
          mieter={einheit.mieter}
        />
        {/* Hover-only action icons */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/e:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Einheit bearbeiten"
            aria-label="Einheit bearbeiten"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
            title="Einheit löschen"
            aria-label="Einheit löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Partner badges (Eigentümer + Mieter pills for tree nodes)
// ============================================================================

function PartnerBadges({
  eigentuemer,
  mieter,
  max = 2,
}: {
  eigentuemer: PartnerMini[];
  mieter: PartnerMini[];
  max?: number;
}) {
  if (eigentuemer.length === 0 && mieter.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {eigentuemer.slice(0, max).map((p) => (
        <span
          key={`eig-${p.id}`}
          title={`Eigentümer: ${p.name}`}
          className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300"
        >
          <Crown className="h-2.5 w-2.5" />
          {p.name}
        </span>
      ))}
      {eigentuemer.length > max && (
        <span
          title={eigentuemer.map((p) => p.name).join(', ')}
          className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300"
        >
          +{eigentuemer.length - max}
        </span>
      )}
      {mieter.slice(0, max).map((p) => (
        <span
          key={`mie-${p.id}`}
          title={`Mieter: ${p.name}`}
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
        >
          <Users className="h-2.5 w-2.5" />
          {p.name}
        </span>
      ))}
      {mieter.length > max && (
        <span
          title={mieter.map((p) => p.name).join(', ')}
          className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
        >
          +{mieter.length - max}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Grundriss panel
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Grundriss
          </div>
          <div className="text-sm font-medium text-zinc-100">
            {stockwerk.bezeichnung}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              onClick={() => {
                if (
                  confirm(
                    `Grundriss für „${stockwerk.bezeichnung}" wirklich löschen?`,
                  )
                ) {
                  deleteGrundriss.mutate();
                }
              }}
              disabled={deleteGrundriss.isPending}
              className="flex items-center gap-1.5 rounded-md border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              title="Grundriss entfernen"
            >
              <Trash2 className="h-3 w-3" />{' '}
              {deleteGrundriss.isPending ? 'lösche …' : 'Löschen'}
            </button>
          )}
        </div>
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
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/30 text-sm text-zinc-500">
          <div className="text-center">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            Noch kein Grundriss hinterlegt.
            <div className="text-[10px]">PNG / JPG / WEBP / PDF, max 10 MB</div>
          </div>
        </div>
      )}
    </div>
  );
}
