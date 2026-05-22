import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  DoorOpen,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import {
  objektApi,
  objektstrukturApi,
  partnerApi,
} from '../api/endpoints';
import type {
  Ausrichtung,
  HausRead,
  StockwerkRead,
  EinheitRead,
} from '../api/types';

const AUSRICHTUNG_LABEL: Record<Ausrichtung, string> = {
  nord: '⬆ Nord',
  ost: '➡ Ost',
  sued: '⬇ Süd',
  west: '⬅ West',
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

  const [openHaus, setOpenHaus] = useState<Record<string, boolean>>({});
  const [openStockwerk, setOpenStockwerk] = useState<Record<string, boolean>>({});
  const [activeStockwerkId, setActiveStockwerkId] = useState<string | null>(null);

  // Standard: erstes Haus aufgeklappt
  useEffect(() => {
    const houses = treeQuery.data ?? [];
    if (houses.length > 0 && Object.keys(openHaus).length === 0) {
      setOpenHaus({ [houses[0]!.id]: true });
    }
  }, [treeQuery.data, openHaus]);

  const createHaus = useMutation({
    mutationFn: (bezeichnung: string) =>
      objektstrukturApi.createHaus(objektId, { bezeichnung }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const removeHaus = useMutation({
    mutationFn: (hausId: string) => objektstrukturApi.removeHaus(hausId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const createStockwerk = useMutation({
    mutationFn: ({ hausId, bezeichnung, ausrichtung }: { hausId: string; bezeichnung: string; ausrichtung: Ausrichtung | null }) =>
      objektstrukturApi.createStockwerk(hausId, { bezeichnung, ausrichtung }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const removeStockwerk = useMutation({
    mutationFn: (swId: string) => objektstrukturApi.removeStockwerk(swId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const createEinheit = useMutation({
    mutationFn: ({ swId, bezeichnung }: { swId: string; bezeichnung: string }) =>
      objektstrukturApi.createEinheit(swId, { bezeichnung }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const removeEinheit = useMutation({
    mutationFn: (eId: string) => objektstrukturApi.removeEinheit(eId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });
  const updateEinheitMieter = useMutation({
    mutationFn: ({ eId, mieterIds }: { eId: string; mieterIds: string[] }) =>
      objektstrukturApi.updateEinheit(eId, { mieter_ids: mieterIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objekt-tree', objektId] }),
  });

  const stockwerke = (treeQuery.data ?? []).flatMap((h) => h.stockwerke);
  const activeStockwerk = activeStockwerkId
    ? stockwerke.find((s) => s.id === activeStockwerkId) ?? null
    : null;

  if (!objektId) return <div className="p-6 text-sm text-zinc-500">Kein Objekt ausgewählt.</div>;

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
        </div>
        <button
          type="button"
          onClick={() => {
            const b = prompt('Haus-Bezeichnung:', 'Haus B');
            if (b) createHaus.mutate(b);
          }}
          className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neues Haus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Linker Tree */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          {treeQuery.isLoading && (
            <div className="py-8 text-center text-sm text-zinc-500">Lade Struktur …</div>
          )}
          {treeQuery.data?.length === 0 && (
            <div className="py-8 text-center">
              <Building2 className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-400">
                Noch keine Häuser angelegt.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Lege oben rechts ein Haus an, dann Stockwerke und Einheiten.
              </p>
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
                onAddStockwerk={() => {
                  const b = prompt('Stockwerk-Bezeichnung:', 'EG');
                  if (b) {
                    const a = prompt('Ausrichtung (nord/ost/sued/west) — optional, leer lassen für keine:');
                    const aus = ['nord', 'ost', 'sued', 'west'].includes(a ?? '')
                      ? (a as Ausrichtung)
                      : null;
                    createStockwerk.mutate({ hausId: h.id, bezeichnung: b, ausrichtung: aus });
                  }
                }}
                onAddEinheit={(swId) => {
                  const b = prompt('Einheit-Bezeichnung:', 'EG-01');
                  if (b) createEinheit.mutate({ swId, bezeichnung: b });
                }}
                onRemoveHaus={() => {
                  if (confirm(`Haus "${h.bezeichnung}" wirklich löschen?`)) removeHaus.mutate(h.id);
                }}
                onRemoveStockwerk={(swId, bez) => {
                  if (confirm(`Stockwerk "${bez}" wirklich löschen?`)) removeStockwerk.mutate(swId);
                }}
                onRemoveEinheit={(eId, bez) => {
                  if (confirm(`Einheit "${bez}" wirklich löschen?`)) removeEinheit.mutate(eId);
                }}
                onUpdateEinheitMieter={(eId, mieterIds) =>
                  updateEinheitMieter.mutate({ eId, mieterIds })
                }
                allPartner={partnerQuery.data?.items ?? []}
              />
            ))}
          </div>
        </div>

        {/* Rechts: Grundriss-Panel */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          {activeStockwerk ? (
            <GrundrissPanel stockwerk={activeStockwerk} objektId={objektId} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              <div className="text-center">
                <Layers className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
                Stockwerk auswählen, um Grundriss anzuzeigen / hochzuladen
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HausNode(props: {
  haus: HausRead;
  open: boolean;
  onToggle: () => void;
  openStockwerk: Record<string, boolean>;
  setOpenStockwerk: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  activeStockwerkId: string | null;
  setActiveStockwerkId: (id: string | null) => void;
  onAddStockwerk: () => void;
  onAddEinheit: (swId: string) => void;
  onRemoveHaus: () => void;
  onRemoveStockwerk: (swId: string, bez: string) => void;
  onRemoveEinheit: (eId: string, bez: string) => void;
  onUpdateEinheitMieter: (eId: string, mieterIds: string[]) => void;
  allPartner: { id: string; name: string; typen: string[] }[];
}) {
  const {
    haus,
    open,
    onToggle,
    openStockwerk,
    setOpenStockwerk,
    activeStockwerkId,
    setActiveStockwerkId,
    onAddStockwerk,
    onAddEinheit,
    onRemoveHaus,
    onRemoveStockwerk,
    onRemoveEinheit,
    onUpdateEinheitMieter,
    allPartner,
  } = props;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/30">
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-zinc-100"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Building2 className="h-4 w-4 text-emerald-400" /> {haus.bezeichnung}
        </button>
        <span className="text-[10px] text-zinc-500">
          {haus.stockwerke.length} Stockwerk{haus.stockwerke.length === 1 ? '' : 'e'}
        </span>
        <button
          type="button"
          onClick={onAddStockwerk}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Stockwerk hinzufügen"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemoveHaus}
          className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          title="Haus löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="space-y-1 px-2 pb-2 pl-6">
          {haus.stockwerke.length === 0 && (
            <p className="py-2 text-xs text-zinc-500">Keine Stockwerke angelegt.</p>
          )}
          {haus.stockwerke.map((s) => (
            <StockwerkNode
              key={s.id}
              stockwerk={s}
              open={!!openStockwerk[s.id]}
              onToggle={() => setOpenStockwerk((st) => ({ ...st, [s.id]: !st[s.id] }))}
              isActive={activeStockwerkId === s.id}
              setActive={() => setActiveStockwerkId(s.id)}
              onAddEinheit={() => onAddEinheit(s.id)}
              onRemove={() => onRemoveStockwerk(s.id, s.bezeichnung)}
              onRemoveEinheit={onRemoveEinheit}
              onUpdateEinheitMieter={onUpdateEinheitMieter}
              allPartner={allPartner}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StockwerkNode(props: {
  stockwerk: StockwerkRead;
  open: boolean;
  onToggle: () => void;
  isActive: boolean;
  setActive: () => void;
  onAddEinheit: () => void;
  onRemove: () => void;
  onRemoveEinheit: (eId: string, bez: string) => void;
  onUpdateEinheitMieter: (eId: string, mieterIds: string[]) => void;
  allPartner: { id: string; name: string; typen: string[] }[];
}) {
  const { stockwerk, open, onToggle, isActive, setActive, onAddEinheit, onRemove, onRemoveEinheit, onUpdateEinheitMieter, allPartner } = props;
  return (
    <div
      className={clsx(
        'rounded-md border bg-zinc-950/30',
        isActive ? 'border-emerald-500/40' : 'border-zinc-800',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left text-sm text-zinc-200"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
        </button>
        <span className="text-[10px] text-zinc-500">
          {stockwerk.einheiten.length} Einheit{stockwerk.einheiten.length === 1 ? '' : 'en'}
        </span>
        <button
          type="button"
          onClick={setActive}
          className={clsx(
            'rounded-md p-1 hover:bg-zinc-800',
            isActive ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200',
          )}
          title="Grundriss anzeigen"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onAddEinheit}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Einheit hinzufügen"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          title="Stockwerk löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="space-y-1 px-2 pb-2 pl-6">
          {stockwerk.einheiten.length === 0 && (
            <p className="py-1 text-xs text-zinc-500">Keine Einheiten.</p>
          )}
          {stockwerk.einheiten.map((e) => (
            <EinheitNode
              key={e.id}
              einheit={e}
              onRemove={() => onRemoveEinheit(e.id, e.bezeichnung)}
              onUpdateMieter={(mieterIds) => onUpdateEinheitMieter(e.id, mieterIds)}
              allPartner={allPartner}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EinheitNode(props: {
  einheit: EinheitRead;
  onRemove: () => void;
  onUpdateMieter: (mieterIds: string[]) => void;
  allPartner: { id: string; name: string; typen: string[] }[];
}) {
  const { einheit, onRemove, onUpdateMieter, allPartner } = props;
  const [showMieter, setShowMieter] = useState(false);
  const mieterIds = einheit.mieter.map((m) => m.id);
  const mieterPartner = allPartner.filter((p) => p.typen.includes('mieter'));
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/20">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <DoorOpen className="h-3.5 w-3.5 text-amber-400" />
        <span className="flex-1 text-sm text-zinc-200">{einheit.bezeichnung}</span>
        {einheit.groesse_qm && (
          <span className="text-[10px] text-zinc-500">{einheit.groesse_qm} m²</span>
        )}
        {einheit.mieter.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
            {einheit.mieter.length === 1 ? einheit.mieter[0]!.name : `${einheit.mieter.length} Mieter`}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowMieter((v) => !v)}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Mieter zuordnen"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          title="Einheit löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {showMieter && (
        <div className="border-t border-zinc-800 px-2 py-2">
          <div className="mb-1 text-[10px] text-zinc-500">Mieter</div>
          <div className="flex flex-wrap gap-1">
            {mieterPartner.length === 0 && (
              <span className="text-[10px] text-zinc-500">
                Keine Mieter angelegt (Stammdaten → Partner)
              </span>
            )}
            {mieterPartner.map((p) => {
              const active = mieterIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? mieterIds.filter((id) => id !== p.id)
                      : [...mieterIds, p.id];
                    onUpdateMieter(next);
                  }}
                  className={clsx(
                    'rounded-full border px-2 py-0.5 text-[10px]',
                    active
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GrundrissPanel({ stockwerk, objektId }: { stockwerk: StockwerkRead; objektId: string }) {
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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Grundriss
          </div>
          <div className="text-sm font-medium text-zinc-100">{stockwerk.bezeichnung}</div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />{' '}
          {upload.isPending ? 'lädt …' : 'Hochladen'}
        </button>
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
