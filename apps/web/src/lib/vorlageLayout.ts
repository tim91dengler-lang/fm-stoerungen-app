import type {
  BlockRegion,
  TickettypBlockRead,
  TickettypFeldRead,
  TickettypRead,
} from '../api/types';

/**
 * Datengetriebenes Ticket-Layout (Stufe C).
 *
 * Baut aus einer Vorlage (`bloecke` + `felder`) die gerenderte Struktur:
 * Blöcke je Region (links/rechts) nach `reihenfolge`, darin die Felder
 * block-lokal sortiert. Felder ohne passenden Block fallen in den Auffang-Block
 * `weitere` — so geht nie ein Feld verloren. Reine Funktion → voll unit-testbar;
 * gemeinsame Wahrheit für TicketFormEngine (Detail/Erfassen) und Designer-Vorschau.
 */

export const FALLBACK_BLOCK_KEY = 'weitere';

export interface LayoutBlock {
  block_key: string;
  label: string;
  region: BlockRegion;
  reihenfolge: number;
  collapsible_default_open: boolean;
  /** Felder dieses Blocks, block-lokal nach `reihenfolge` sortiert. */
  felder: TickettypFeldRead[];
}

export interface VorlageLayout {
  links: LayoutBlock[];
  rechts: LayoutBlock[];
  /** Lineare Reihenfolge für Mobile: erst links-Region, dann rechts. */
  alle: LayoutBlock[];
}

export interface BuildLayoutOptions {
  /** Leere Blöcke behalten (Designer braucht sie als Drop-Ziele). Default false. */
  includeEmpty?: boolean;
  /** Nur sichtbare Felder einsortieren (Ticket-Render). Default true. */
  onlySichtbar?: boolean;
}

function normRegion(region: string): BlockRegion {
  return region === 'rechts' ? 'rechts' : 'links';
}

export function buildVorlageLayout(
  typ: Pick<TickettypRead, 'bloecke' | 'felder'> | null,
  opts: BuildLayoutOptions = {},
): VorlageLayout {
  const includeEmpty = opts.includeEmpty ?? false;
  const onlySichtbar = opts.onlySichtbar ?? true;
  const empty: VorlageLayout = { links: [], rechts: [], alle: [] };
  if (!typ || typ.bloecke.length === 0) return empty;

  const blockById = new Map<string, TickettypBlockRead>();
  for (const b of typ.bloecke) blockById.set(b.id, b);
  const fallbackBlock =
    typ.bloecke.find((b) => b.block_key === FALLBACK_BLOCK_KEY) ?? null;

  // Felder ihren Blöcken zuordnen (mit Auffang).
  const feldByBlockId = new Map<string, TickettypFeldRead[]>();
  for (const f of typ.felder) {
    if (onlySichtbar && !f.sichtbar) continue;
    let blockId = f.block_id;
    if (!blockId || !blockById.has(blockId)) blockId = fallbackBlock?.id ?? null;
    if (!blockId) continue; // kein Block und kein Auffang → nicht rendern
    const arr = feldByBlockId.get(blockId) ?? [];
    arr.push(f);
    feldByBlockId.set(blockId, arr);
  }

  const toLayoutBlock = (b: TickettypBlockRead): LayoutBlock => ({
    block_key: b.block_key,
    label: b.label,
    region: normRegion(b.region),
    reihenfolge: b.reihenfolge,
    collapsible_default_open: b.collapsible_default_open,
    felder: (feldByBlockId.get(b.id) ?? [])
      .slice()
      .sort((a, z) => a.reihenfolge - z.reihenfolge),
  });

  const blocks = typ.bloecke
    .slice()
    .sort((a, z) => a.reihenfolge - z.reihenfolge)
    .map(toLayoutBlock)
    .filter((b) => includeEmpty || b.felder.length > 0);

  const links = blocks.filter((b) => b.region === 'links');
  const rechts = blocks.filter((b) => b.region === 'rechts');
  return { links, rechts, alle: [...links, ...rechts] };
}
