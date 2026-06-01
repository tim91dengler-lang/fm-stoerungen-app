import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TickettypBlockRead, TickettypFeldRead } from '../../api/types';
import { buildVorlageLayout } from '../../lib/vorlageLayout';
import { TicketFormEngine } from './TicketFormEngine';

function block(
  partial: Partial<TickettypBlockRead> & { id: string; block_key: string },
): TickettypBlockRead {
  return {
    label: partial.block_key,
    region: 'links',
    reihenfolge: 0,
    ist_system_block: false,
    collapsible_default_open: true,
    ...partial,
  };
}

function feld(
  partial: Partial<TickettypFeldRead> & { feld_key: string },
): TickettypFeldRead {
  return {
    id: `f-${partial.feld_key}`,
    label: partial.feld_key,
    ist_system_feld: true,
    sichtbar: true,
    pflicht: false,
    nur_admin_sichtbar: false,
    reihenfolge: 0,
    block_id: null,
    ...partial,
  };
}

const sampleTyp = {
  bloecke: [
    block({
      id: 'b-kopf',
      block_key: 'kopf',
      label: 'Kopf',
      region: 'links',
      reihenfolge: 0,
    }),
    block({
      id: 'b-ver',
      block_key: 'verortung',
      label: 'Verortung',
      region: 'links',
      reihenfolge: 1,
    }),
    block({
      id: 'b-bel',
      block_key: 'belege',
      label: 'Belege',
      region: 'rechts',
      reihenfolge: 0,
    }),
  ],
  felder: [
    feld({ feld_key: 'titel', block_id: 'b-kopf', reihenfolge: 0 }),
    feld({ feld_key: 'objekt', block_id: 'b-ver', reihenfolge: 0 }),
    feld({ feld_key: 'foto', block_id: 'b-bel', reihenfolge: 0 }),
  ],
};

const renderFeld = (f: TickettypFeldRead) => <span>FELD:{f.feld_key}</span>;

describe('TicketFormEngine', () => {
  it('rendert die Block-Titel beider Regionen', () => {
    render(
      <TicketFormEngine layout={buildVorlageLayout(sampleTyp)} renderFeld={renderFeld} />,
    );
    expect(screen.getByText('Kopf')).toBeInTheDocument();
    expect(screen.getByText('Verortung')).toBeInTheDocument();
    expect(screen.getByText('Belege')).toBeInTheDocument();
  });

  it('rendert Felder über renderFeld im jeweiligen Block', () => {
    const { container } = render(
      <TicketFormEngine layout={buildVorlageLayout(sampleTyp)} renderFeld={renderFeld} />,
    );
    expect(screen.getByText('FELD:titel')).toBeInTheDocument();
    expect(screen.getByText('FELD:objekt')).toBeInTheDocument();
    const belege = container.querySelector('[data-block-key="belege"]');
    expect(belege).not.toBeNull();
    expect(within(belege as HTMLElement).getByText('FELD:foto')).toBeInTheDocument();
  });

  it('rendert den Chat-Slot', () => {
    render(
      <TicketFormEngine
        layout={buildVorlageLayout(sampleTyp)}
        renderFeld={renderFeld}
        chatSlot={<div>CHAT-SLOT</div>}
      />,
    );
    expect(screen.getByText('CHAT-SLOT')).toBeInTheDocument();
  });

  it('rendert leeres Layout ohne Blöcke', () => {
    const { container } = render(
      <TicketFormEngine layout={buildVorlageLayout(null)} renderFeld={renderFeld} />,
    );
    expect(container.querySelectorAll('[data-block-key]')).toHaveLength(0);
  });

  it('hält die Block-Reihenfolge ein (links vor rechts, nach reihenfolge)', () => {
    const { container } = render(
      <TicketFormEngine layout={buildVorlageLayout(sampleTyp)} renderFeld={renderFeld} />,
    );
    const keys = Array.from(container.querySelectorAll('[data-block-key]')).map((el) =>
      el.getAttribute('data-block-key'),
    );
    expect(keys).toEqual(['kopf', 'verortung', 'belege']);
  });
});
