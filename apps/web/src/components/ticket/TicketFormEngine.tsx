import { ChevronRight } from 'lucide-react';

import type { TickettypFeldRead } from '../../api/types';
import type { LayoutBlock, VorlageLayout } from '../../lib/vorlageLayout';

/**
 * Datengetriebene Ticket-Render-Engine (Stufe C, hinter Flag `vorlage_layout_v2`).
 *
 * Rendert die Block-/Region-Struktur eines Tickets aus dem konfigurierten Layout
 * (`buildVorlageLayout`): linke Spalte (3/5) + rechte Spalte (2/5), Blöcke als
 * Accordions in `reihenfolge`, Felder darin block-lokal. WIE ein einzelnes Feld
 * gezeichnet wird, liefert der Aufrufer über `renderFeld` (Renderer-Registry für
 * Detail- bzw. Erfassen-Modus) — die Engine selbst ist render-agnostisch und damit
 * pur strukturell testbar.
 *
 * Feste Slots, die NICHT über den Designer laufen (Status/Workflow-Kopf, Chat,
 * Verlauf), bleiben außerhalb der Engine und werden vom Panel als Rahmen gesetzt;
 * `chatSlot` wird in die rechte Spalte ans Ende gehängt (Konzept §4.2/§4.3).
 */

interface EngineAccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function EngineAccordion({ title, defaultOpen = false, children }: EngineAccordionProps) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-md border border-zinc-800 bg-zinc-900"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 lg:min-h-0">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="border-t border-zinc-800 px-3 py-3">{children}</div>
    </details>
  );
}

interface BlockSectionProps {
  block: LayoutBlock;
  renderFeld: (feld: TickettypFeldRead, block: LayoutBlock) => React.ReactNode;
}

function BlockSection({ block, renderFeld }: BlockSectionProps) {
  return (
    <EngineAccordion title={block.label} defaultOpen={block.collapsible_default_open}>
      <div className="space-y-3" data-block-key={block.block_key}>
        {block.felder.map((feld) => (
          <div key={feld.id} data-feld-key={feld.feld_key}>
            {renderFeld(feld, block)}
          </div>
        ))}
      </div>
    </EngineAccordion>
  );
}

export interface TicketFormEngineProps {
  layout: VorlageLayout;
  renderFeld: (feld: TickettypFeldRead, block: LayoutBlock) => React.ReactNode;
  /** Feste Slots, die NICHT über den Designer laufen (kein Block). */
  leftHeaderSlot?: React.ReactNode; // Status/Workflow/Wartet — oben links
  leftFooterSlot?: React.ReactNode; // Verlauf/Löschen — unten links
  chatSlot?: React.ReactNode; // Chat — oben rechts (Desktop)
  /** Einspaltig (Erfassen-Modal): alle Blöcke gestapelt, ohne Links/Rechts-Split. */
  singleColumn?: boolean;
}

export function TicketFormEngine({
  layout,
  renderFeld,
  leftHeaderSlot,
  leftFooterSlot,
  chatSlot,
  singleColumn = false,
}: TicketFormEngineProps) {
  if (singleColumn) {
    return (
      <div className="space-y-3">
        {leftHeaderSlot}
        {layout.alle.map((block) => (
          <BlockSection key={block.block_key} block={block} renderFeld={renderFeld} />
        ))}
        {chatSlot}
        {leftFooterSlot}
      </div>
    );
  }
  // Rechte Spalte nur reservieren, wenn sie etwas trägt (Blöcke oder Chat) —
  // sonst nimmt die linke Region die volle Breite ein, statt eine leere
  // 2/5-Lücke zu zeigen (z. B. Vorlagen ohne rechts-Blöcke).
  const showRight = layout.rechts.length > 0 || Boolean(chatSlot);
  return (
    <>
      <div
        className={
          showRight
            ? 'contents lg:flex lg:w-3/5 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:px-5 lg:py-4'
            : 'contents lg:flex lg:w-full lg:flex-col lg:gap-3 lg:overflow-y-auto lg:px-5 lg:py-4'
        }
      >
        {leftHeaderSlot}
        {layout.links.map((block) => (
          <BlockSection key={block.block_key} block={block} renderFeld={renderFeld} />
        ))}
        {leftFooterSlot}
      </div>
      {showRight && (
        <div className="contents lg:flex lg:w-2/5 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:px-5 lg:py-4">
          {chatSlot}
          {layout.rechts.map((block) => (
            <BlockSection key={block.block_key} block={block} renderFeld={renderFeld} />
          ))}
        </div>
      )}
    </>
  );
}
