import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { ArrowLeftRight, Eye, EyeOff, GripVertical, Lock, Plus, Star, Trash2 } from 'lucide-react';

import { tickettypApi } from '../api/endpoints';
import type {
  BlockRegion,
  LayoutWrite,
  TickettypBlockRead,
  TickettypFeldRead,
  TickettypRead,
} from '../api/types';

/**
 * Stufe-C Designer-Builder (hinter Flag `vorlage_layout_v2`).
 *
 * Konfiguriert das Block-Layout einer Vorlage per **Drag & Drop**: Blöcke
 * untereinander sortieren UND zwischen den Regionen links/rechts ziehen; Felder
 * innerhalb eines Blocks sortieren UND per Drag in einen anderen Block ziehen.
 * Daneben: Block umbenennen, Region per Button wechseln (Fallback), Block
 * anlegen/löschen, Feld ein-/ausblenden + Pflicht. Speichert atomar über
 * `PUT /{id}/layout`.
 *
 * DnD-Architektur (Multi-Container, dnd-kit): IDs sind nach Typ präfixiert
 * (`b:` Block, `f:` Feld, `r:` Region-Dropzone, `z:` Block-Feld-Dropzone). Die
 * Kollisionserkennung filtert die Dropzones nach aktivem Typ, sodass Block- und
 * Feld-Drags sich nicht stören. Geschützte Blöcke `kopf`/`weitere` sind nicht
 * löschbar (Backend erzwingt es ebenso).
 */

const PROTECTED = new Set(['kopf', 'weitere']);
const REGIONS: BlockRegion[] = ['links', 'rechts'];

const isBlockId = (id: string) => id.startsWith('b:');
const isFieldId = (id: string) => id.startsWith('f:');
const keyOf = (id: string) => id.slice(2);

interface LocalBlock {
  block_key: string;
  label: string;
  region: BlockRegion;
  reihenfolge: number;
  collapsible_default_open: boolean;
  ist_system_block: boolean;
}
interface LocalFeld {
  feld_key: string;
  label: string;
  block_key: string;
  reihenfolge: number;
  sichtbar: boolean;
  pflicht: boolean;
}

function toLocal(typ: TickettypRead): { blocks: LocalBlock[]; felder: LocalFeld[] } {
  const idToKey = new Map<string, string>(typ.bloecke.map((b) => [b.id, b.block_key]));
  const blocks: LocalBlock[] = typ.bloecke
    .map((b: TickettypBlockRead) => ({
      block_key: b.block_key,
      label: b.label,
      region: b.region,
      reihenfolge: b.reihenfolge,
      collapsible_default_open: b.collapsible_default_open,
      ist_system_block: b.ist_system_block,
    }))
    .sort((a, z) => a.reihenfolge - z.reihenfolge);
  const felder: LocalFeld[] = typ.felder.map((f: TickettypFeldRead) => ({
    feld_key: f.feld_key,
    label: f.label,
    block_key: (f.block_id && idToKey.get(f.block_id)) || 'weitere',
    reihenfolge: f.reihenfolge,
    sichtbar: f.sichtbar,
    pflicht: f.pflicht,
  }));
  return { blocks, felder };
}

/** reihenfolge je Region neu als 0..n vergeben (stabile, lückenlose Indizes). */
function reindexBlocks(arr: LocalBlock[]): LocalBlock[] {
  return REGIONS.flatMap((region) =>
    arr
      .filter((b) => b.region === region)
      .sort((a, z) => a.reihenfolge - z.reihenfolge)
      .map((b, i) => ({ ...b, reihenfolge: i })),
  );
}

/** reihenfolge je Block neu als 0..n vergeben. */
function reindexFelder(arr: LocalFeld[]): LocalFeld[] {
  const byBlock = new Map<string, LocalFeld[]>();
  for (const f of arr) {
    const g = byBlock.get(f.block_key) ?? [];
    g.push(f);
    byBlock.set(f.block_key, g);
  }
  const out: LocalFeld[] = [];
  for (const g of byBlock.values()) {
    g.sort((a, z) => a.reihenfolge - z.reihenfolge).forEach((f, i) =>
      out.push({ ...f, reihenfolge: i }),
    );
  }
  return out;
}

export function VorlageLayoutBuilder({
  tickettyp,
  onSaved,
}: {
  tickettyp: TickettypRead;
  onSaved?: () => void;
}) {
  const initial = useMemo(() => toLocal(tickettyp), [tickettyp]);
  const [blocks, setBlocks] = useState<LocalBlock[]>(initial.blocks);
  const [felder, setFelder] = useState<LocalFeld[]>(initial.felder);
  const [error, setError] = useState<string | null>(null);
  const [customSeq, setCustomSeq] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function feldOf(blockKey: string): LocalFeld[] {
    return felder
      .filter((f) => f.block_key === blockKey)
      .sort((a, z) => a.reihenfolge - z.reihenfolge);
  }
  function blockOf(region: BlockRegion): LocalBlock[] {
    return blocks
      .filter((b) => b.region === region)
      .sort((a, z) => a.reihenfolge - z.reihenfolge);
  }
  const fieldBlock = (feldKey: string) =>
    felder.find((f) => f.feld_key === feldKey)?.block_key;

  function patchBlock(key: string, patch: Partial<LocalBlock>) {
    setBlocks((prev) => prev.map((b) => (b.block_key === key ? { ...b, ...patch } : b)));
  }
  function patchFeld(key: string, patch: Partial<LocalFeld>) {
    setFelder((prev) => prev.map((f) => (f.feld_key === key ? { ...f, ...patch } : f)));
  }

  // Kollisionen je aktivem Typ einschränken: ein Feld-Drag sieht nur Feld-/
  // Block-Feld-Dropzones, ein Block-Drag nur Block-/Region-Dropzones.
  const collisionDetection: CollisionDetection = (args) => {
    const active = String(args.active.id);
    const want = isBlockId(active)
      ? (id: string) => isBlockId(id) || id.startsWith('r:')
      : (id: string) => isFieldId(id) || id.startsWith('z:');
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => want(String(c.id))),
    });
  };

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // Cross-Container live während des Drags: Feld in anderen Block / Block in
  // andere Region verschieben (ans Ende; finale Position kommt in DragEnd).
  function handleDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;

    if (isFieldId(active)) {
      const activeKey = keyOf(active);
      const from = fieldBlock(activeKey);
      if (!from) return;
      let to: string | undefined;
      if (isFieldId(over)) to = fieldBlock(keyOf(over));
      else if (over.startsWith('z:')) to = over.slice(2);
      if (!to || to === from) return;
      setFelder((prev) =>
        reindexFelder(
          prev.map((f) =>
            f.feld_key === activeKey ? { ...f, block_key: to!, reihenfolge: 1e6 } : f,
          ),
        ),
      );
    } else if (isBlockId(active)) {
      const activeKey = keyOf(active);
      const from = blocks.find((b) => b.block_key === activeKey)?.region;
      if (!from) return;
      let to: BlockRegion | undefined;
      if (isBlockId(over)) to = blocks.find((b) => b.block_key === keyOf(over))?.region;
      else if (over.startsWith('r:')) to = over.slice(2) as BlockRegion;
      if (!to || to === from) return;
      setBlocks((prev) =>
        reindexBlocks(
          prev.map((b) =>
            b.block_key === activeKey ? { ...b, region: to!, reihenfolge: 1e6 } : b,
          ),
        ),
      );
    }
  }

  // Finale Sortierung innerhalb des (ggf. neuen) Containers.
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;

    if (isFieldId(active)) {
      const activeKey = keyOf(active);
      const overKey = isFieldId(over) ? keyOf(over) : null;
      if (!overKey || overKey === activeKey) return;
      const block = fieldBlock(activeKey);
      if (!block || fieldBlock(overKey) !== block) return;
      const group = feldOf(block);
      const oldIdx = group.findIndex((f) => f.feld_key === activeKey);
      const newIdx = group.findIndex((f) => f.feld_key === overKey);
      if (oldIdx < 0 || newIdx < 0) return;
      const order = new Map(
        arrayMove(group, oldIdx, newIdx).map((f, i) => [f.feld_key, i]),
      );
      setFelder((prev) =>
        prev.map((f) =>
          f.block_key === block ? { ...f, reihenfolge: order.get(f.feld_key) ?? f.reihenfolge } : f,
        ),
      );
    } else if (isBlockId(active)) {
      const activeKey = keyOf(active);
      const overKey = isBlockId(over) ? keyOf(over) : null;
      if (!overKey || overKey === activeKey) return;
      const region = blocks.find((b) => b.block_key === activeKey)?.region;
      if (!region || blocks.find((b) => b.block_key === overKey)?.region !== region) return;
      const group = blockOf(region);
      const oldIdx = group.findIndex((b) => b.block_key === activeKey);
      const newIdx = group.findIndex((b) => b.block_key === overKey);
      if (oldIdx < 0 || newIdx < 0) return;
      const order = new Map(
        arrayMove(group, oldIdx, newIdx).map((b, i) => [b.block_key, i]),
      );
      setBlocks((prev) =>
        prev.map((b) =>
          b.region === region ? { ...b, reihenfolge: order.get(b.block_key) ?? b.reihenfolge } : b,
        ),
      );
    }
  }

  function addBlock(region: BlockRegion) {
    // Kollisionsfreien Key vergeben: hochzählen, bis `custom-N` nicht schon
    // existiert (sonst würden zwei Blöcke denselben Key teilen und beim Speichern
    // still zusammengeführt). Robust auch nach Reload, wenn customSeq bei 0 startet.
    const taken = new Set(blocks.map((b) => b.block_key));
    let seq = customSeq + 1;
    while (taken.has(`custom-${seq}`)) seq++;
    setCustomSeq(seq);
    const maxR = Math.max(
      -1,
      ...blocks.filter((b) => b.region === region).map((b) => b.reihenfolge),
    );
    setBlocks((prev) => [
      ...prev,
      {
        block_key: `custom-${seq}`,
        label: 'Neuer Block',
        region,
        reihenfolge: maxR + 1,
        collapsible_default_open: true,
        ist_system_block: false,
      },
    ]);
  }

  function deleteBlock(key: string) {
    if (PROTECTED.has(key)) return;
    // Felder des Blocks in den Auffang-Block "weitere" verschieben (kein Verlust).
    setFelder((prev) =>
      reindexFelder(
        prev.map((f) => (f.block_key === key ? { ...f, block_key: 'weitere' } : f)),
      ),
    );
    setBlocks((prev) => prev.filter((b) => b.block_key !== key));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const payload: LayoutWrite = {
      bloecke: blocks.map((b) => ({
        block_key: b.block_key,
        label: b.label,
        region: b.region,
        reihenfolge: b.reihenfolge,
        collapsible_default_open: b.collapsible_default_open,
      })),
      felder: felder.map((f) => ({
        feld_key: f.feld_key,
        block_key: f.block_key,
        reihenfolge: f.reihenfolge,
        sichtbar: f.sichtbar,
        pflicht: f.pflicht,
        label: f.label,
      })),
    };
    try {
      await tickettypApi.saveLayout(tickettyp.id, payload);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  const activeBlock =
    activeId && isBlockId(activeId)
      ? blocks.find((b) => b.block_key === keyOf(activeId))
      : null;
  const activeFeld =
    activeId && isFieldId(activeId)
      ? felder.find((f) => f.feld_key === keyOf(activeId))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Block-Layout</h2>
          <p className="text-[11px] text-zinc-500">
            Blöcke und Felder per <GripVertical className="inline h-3 w-3" /> ziehen —
            sortieren, Region wechseln, Feld in anderen Block legen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? 'Speichert …' : 'Layout speichern'}
        </button>
      </div>
      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {REGIONS.map((region) => (
            <RegionColumn key={region} region={region} onAdd={() => addBlock(region)}>
              <SortableContext
                items={blockOf(region).map((b) => `b:${b.block_key}`)}
                strategy={verticalListSortingStrategy}
              >
                {blockOf(region).map((b) => (
                  <BlockCard
                    key={b.block_key}
                    block={b}
                    felder={feldOf(b.block_key)}
                    onRename={(label) => patchBlock(b.block_key, { label })}
                    onSwapRegion={() =>
                      patchBlock(b.block_key, {
                        region: b.region === 'links' ? 'rechts' : 'links',
                      })
                    }
                    onDelete={() => deleteBlock(b.block_key)}
                    onToggleSichtbar={(k, v) => patchFeld(k, { sichtbar: v })}
                    onTogglePflicht={(k, v) => patchFeld(k, { pflicht: v })}
                  />
                ))}
              </SortableContext>
            </RegionColumn>
          ))}
        </div>

        <DragOverlay>
          {activeBlock ? (
            <div className="rounded-md border border-emerald-400/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 shadow-lg">
              {activeBlock.label}
            </div>
          ) : activeFeld ? (
            <div className="rounded border border-emerald-400/60 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 shadow-lg">
              {activeFeld.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function RegionColumn({
  region,
  onAdd,
  children,
}: {
  region: BlockRegion;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `r:${region}` });
  return (
    <section
      ref={setNodeRef}
      className={clsx(
        'space-y-3 rounded-lg border p-3 transition-colors',
        isOver ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Region: {region === 'links' ? 'Links' : 'Rechts'}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <Plus className="h-3.5 w-3.5" /> Block
        </button>
      </div>
      {children}
    </section>
  );
}

function BlockCard({
  block,
  felder,
  onRename,
  onSwapRegion,
  onDelete,
  onToggleSichtbar,
  onTogglePflicht,
}: {
  block: LocalBlock;
  felder: LocalFeld[];
  onRename: (label: string) => void;
  onSwapRegion: () => void;
  onDelete: () => void;
  onToggleSichtbar: (feldKey: string, v: boolean) => void;
  onTogglePflicht: (feldKey: string, v: boolean) => void;
}) {
  const isProtected = PROTECTED.has(block.block_key);
  const sortable = useSortable({ id: `b:${block.block_key}`, disabled: isProtected });
  const { setNodeRef: setZoneRef, isOver: zoneOver } = useDroppable({
    id: `z:${block.block_key}`,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-block-key={block.block_key}
      className={clsx(
        'rounded-md border bg-zinc-900/50 p-2',
        sortable.isDragging ? 'border-emerald-400/60 opacity-50' : 'border-zinc-800',
      )}
    >
      <div className="mb-2 flex items-center gap-1">
        {isProtected ? (
          <span
            title="Geschützter System-Block — fix"
            aria-label={`Block ${block.label} ist geschützt`}
            className="rounded p-1 text-zinc-600"
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Block ${block.label} ziehen`}
            title="ziehen zum Sortieren / Region wechseln"
            className="cursor-grab touch-none rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <input
          aria-label={`Block-Name ${block.block_key}`}
          value={block.label}
          onChange={(e) => onRename(e.target.value)}
          readOnly={isProtected}
          title={isProtected ? 'Geschützter Block — nicht umbenennbar' : undefined}
          className="min-w-0 flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 read-only:text-zinc-400"
        />
        {!isProtected && (
          <button
            type="button"
            title="Region wechseln"
            onClick={onSwapRegion}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        )}
        {!isProtected && (
          <button
            type="button"
            title="Block löschen"
            onClick={onDelete}
            className="rounded p-1 text-red-400 hover:bg-red-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <SortableContext
        items={felder.map((f) => `f:${f.feld_key}`)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setZoneRef}
          className={clsx(
            'min-h-[1.75rem] space-y-1 rounded transition-colors',
            zoneOver && 'bg-emerald-500/5 ring-1 ring-emerald-500/30',
          )}
        >
          {felder.map((f) => (
            <FieldRow
              key={f.feld_key}
              feld={f}
              onToggleSichtbar={(v) => onToggleSichtbar(f.feld_key, v)}
              onTogglePflicht={(v) => onTogglePflicht(f.feld_key, v)}
            />
          ))}
          {felder.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-zinc-600">
              — leer — Feld hierher ziehen
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function FieldRow({
  feld,
  onToggleSichtbar,
  onTogglePflicht,
}: {
  feld: LocalFeld;
  onToggleSichtbar: (v: boolean) => void;
  onTogglePflicht: (v: boolean) => void;
}) {
  const sortable = useSortable({ id: `f:${feld.feld_key}` });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-feld-key={feld.feld_key}
      className={clsx(
        'flex items-center gap-1 rounded px-2 py-1 text-xs',
        sortable.isDragging
          ? 'bg-emerald-500/10 opacity-50'
          : 'bg-zinc-800/40',
      )}
    >
      <button
        type="button"
        aria-label={`Feld ${feld.label} ziehen`}
        title="ziehen zum Sortieren / in anderen Block"
        className="cursor-grab touch-none rounded p-0.5 text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-zinc-200">{feld.label}</span>
      <button
        type="button"
        title={feld.sichtbar ? 'ausblenden' : 'einblenden'}
        onClick={() => onToggleSichtbar(!feld.sichtbar)}
        className="rounded p-0.5 text-zinc-400 hover:text-zinc-100"
      >
        {feld.sichtbar ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-zinc-600" />
        )}
      </button>
      <button
        type="button"
        title={feld.pflicht ? 'optional' : 'Pflicht'}
        onClick={() => onTogglePflicht(!feld.pflicht)}
        className="rounded p-0.5 hover:bg-zinc-700"
      >
        <Star
          className={clsx(
            'h-3.5 w-3.5',
            feld.pflicht ? 'fill-amber-400 text-amber-400' : 'text-zinc-500',
          )}
        />
      </button>
    </div>
  );
}
