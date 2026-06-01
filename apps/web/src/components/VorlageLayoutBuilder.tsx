import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

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
 * Konfiguriert das Block-Layout einer Vorlage frei: Blöcke anlegen/umbenennen/
 * sortieren/Region wechseln/löschen, Felder ein-/ausblenden, Pflicht setzen, einem
 * Block zuordnen und block-lokal sortieren. Speichert atomar über `PUT /{id}/layout`.
 *
 * Bewusst form-basiert (keine Drag-Simulation) → deterministisch + voll testbar;
 * Geschützte Blöcke `kopf`/`weitere` sind nicht löschbar (Backend erzwingt es ebenso).
 */

const PROTECTED = new Set(['kopf', 'weitere']);
const REGIONS: BlockRegion[] = ['links', 'rechts'];

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

  function feldOf(blockKey: string): LocalFeld[] {
    return felder
      .filter((f) => f.block_key === blockKey)
      .sort((a, z) => a.reihenfolge - z.reihenfolge);
  }

  function patchBlock(key: string, patch: Partial<LocalBlock>) {
    setBlocks((prev) => prev.map((b) => (b.block_key === key ? { ...b, ...patch } : b)));
  }
  function patchFeld(key: string, patch: Partial<LocalFeld>) {
    setFelder((prev) => prev.map((f) => (f.feld_key === key ? { ...f, ...patch } : f)));
  }

  function moveBlock(key: string, dir: -1 | 1) {
    const b = blocks.find((x) => x.block_key === key);
    if (!b) return;
    const region = blocks
      .filter((x) => x.region === b.region)
      .sort((a, z) => a.reihenfolge - z.reihenfolge);
    const idx = region.findIndex((x) => x.block_key === key);
    const swap = region[idx + dir];
    if (!swap) return;
    patchBlock(b.block_key, { reihenfolge: swap.reihenfolge });
    patchBlock(swap.block_key, { reihenfolge: b.reihenfolge });
  }

  function moveFeld(key: string, dir: -1 | 1) {
    const f = felder.find((x) => x.feld_key === key);
    if (!f) return;
    const inBlock = feldOf(f.block_key);
    const idx = inBlock.findIndex((x) => x.feld_key === key);
    const swap = inBlock[idx + dir];
    if (!swap) return;
    patchFeld(f.feld_key, { reihenfolge: swap.reihenfolge });
    patchFeld(swap.feld_key, { reihenfolge: f.reihenfolge });
  }

  function addBlock(region: BlockRegion) {
    const seq = customSeq + 1;
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
      prev.map((f) => (f.block_key === key ? { ...f, block_key: 'weitere' } : f)),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Block-Layout</h2>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REGIONS.map((region) => (
          <section
            key={region}
            className="space-y-3 rounded-lg border border-zinc-800 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Region: {region === 'links' ? 'Links' : 'Rechts'}
              </span>
              <button
                type="button"
                onClick={() => addBlock(region)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> Block
              </button>
            </div>

            {blocks
              .filter((b) => b.region === region)
              .sort((a, z) => a.reihenfolge - z.reihenfolge)
              .map((b) => (
                <div
                  key={b.block_key}
                  data-block-key={b.block_key}
                  className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2"
                >
                  <div className="mb-2 flex items-center gap-1">
                    <input
                      aria-label={`Block-Name ${b.block_key}`}
                      value={b.label}
                      onChange={(e) => patchBlock(b.block_key, { label: e.target.value })}
                      className="min-w-0 flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                    />
                    <button
                      type="button"
                      title="nach oben"
                      onClick={() => moveBlock(b.block_key, -1)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="nach unten"
                      onClick={() => moveBlock(b.block_key, 1)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Region wechseln"
                      onClick={() =>
                        patchBlock(b.block_key, {
                          region: b.region === 'links' ? 'rechts' : 'links',
                        })
                      }
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    {!PROTECTED.has(b.block_key) && (
                      <button
                        type="button"
                        title="Block löschen"
                        onClick={() => deleteBlock(b.block_key)}
                        className="rounded p-1 text-red-400 hover:bg-red-500/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {feldOf(b.block_key).map((f) => (
                      <div
                        key={f.feld_key}
                        data-feld-key={f.feld_key}
                        className="flex items-center gap-1 rounded bg-zinc-800/40 px-2 py-1 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-zinc-200">
                          {f.label}
                        </span>
                        <button
                          type="button"
                          title={f.sichtbar ? 'ausblenden' : 'einblenden'}
                          onClick={() => patchFeld(f.feld_key, { sichtbar: !f.sichtbar })}
                          className="rounded p-0.5 text-zinc-400 hover:text-zinc-100"
                        >
                          {f.sichtbar ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-zinc-600" />
                          )}
                        </button>
                        <button
                          type="button"
                          title={f.pflicht ? 'optional' : 'Pflicht'}
                          onClick={() => patchFeld(f.feld_key, { pflicht: !f.pflicht })}
                          className="rounded p-0.5 hover:bg-zinc-700"
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${f.pflicht ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'}`}
                          />
                        </button>
                        <select
                          aria-label={`Block für ${f.feld_key}`}
                          value={f.block_key}
                          onChange={(e) =>
                            patchFeld(f.feld_key, { block_key: e.target.value })
                          }
                          className="rounded-sm border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[11px] text-zinc-200"
                        >
                          {blocks.map((bl) => (
                            <option key={bl.block_key} value={bl.block_key}>
                              {bl.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="hoch"
                          onClick={() => moveFeld(f.feld_key, -1)}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-700"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="runter"
                          onClick={() => moveFeld(f.feld_key, 1)}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-700"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {feldOf(b.block_key).length === 0 && (
                      <div className="px-2 py-1 text-[11px] text-zinc-600">— leer —</div>
                    )}
                  </div>
                </div>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
