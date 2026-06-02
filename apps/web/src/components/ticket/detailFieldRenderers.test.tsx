import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AuswahllisteRead, TicketRead } from '../../api/types';
import { vorlageFelder } from '../../lib/vorlageFelder';
import { type DetailFieldCtx, renderDetailFeld } from './detailFieldRenderers';

function mockTicket(over: Partial<TicketRead> = {}): TicketRead {
  return {
    id: 't-1',
    titel: 'Alter Titel',
    beschreibung: 'Alte Beschreibung',
    faelligkeit_am: null,
    wiederholung: null,
    prioritaet: { id: 'p', key: 'mittel', label: 'Mittel', farbe: null },
    kategorie: null,
    quelle: null,
    stockwerk: null,
    ...over,
  } as unknown as TicketRead;
}

function makeCtx(over: Partial<DetailFieldCtx> = {}): DetailFieldCtx {
  return {
    t: mockTicket(over.t),
    felder: vorlageFelder(null),
    onPatch: vi.fn(),
    hausTree: undefined,
    kategorienListe: undefined,
    quellenListe: undefined,
    beteiligtenRolleOptions: [],
    ...over,
  };
}

describe('DETAIL_RENDERERS — Felder befüllen → Patch', () => {
  it('titel: Blur mit neuem Wert patcht titel', () => {
    const onPatch = vi.fn();
    const ctx = makeCtx({ onPatch });
    render(<div>{renderDetailFeld('titel', ctx)}</div>);
    const input = screen.getByDisplayValue('Alter Titel');
    fireEvent.change(input, { target: { value: 'Neuer Titel' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ titel: 'Neuer Titel' });
  });

  it('titel: unveränderter Wert patcht NICHT', () => {
    const onPatch = vi.fn();
    render(<div>{renderDetailFeld('titel', makeCtx({ onPatch }))}</div>);
    fireEvent.blur(screen.getByDisplayValue('Alter Titel'));
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('beschreibung: Blur patcht beschreibung', () => {
    const onPatch = vi.fn();
    render(<div>{renderDetailFeld('beschreibung', makeCtx({ onPatch }))}</div>);
    const ta = screen.getByDisplayValue('Alte Beschreibung');
    fireEvent.change(ta, { target: { value: 'Neu' } });
    fireEvent.blur(ta);
    expect(onPatch).toHaveBeenCalledWith({ beschreibung: 'Neu' });
  });

  it('faelligkeit_am: Datum wählen patcht (DatePicker)', () => {
    const onPatch = vi.fn();
    render(<div>{renderDetailFeld('faelligkeit_am', makeCtx({ onPatch }))}</div>);
    // DatePicker (kein natives <input type=date>): Trigger öffnen, dann „Heute" wählen.
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Heute'));
    expect(onPatch).toHaveBeenCalledWith({
      faelligkeit_am: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('wiederholung: Auswahl patcht', () => {
    const onPatch = vi.fn();
    render(<div>{renderDetailFeld('wiederholung', makeCtx({ onPatch }))}</div>);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'monthly' } });
    expect(onPatch).toHaveBeenCalledWith({ wiederholung: 'monthly' });
  });

  it('prio: Auswahl patcht prioritaet', () => {
    const onPatch = vi.fn();
    render(<div>{renderDetailFeld('prio', makeCtx({ onPatch }))}</div>);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hoch' } });
    expect(onPatch).toHaveBeenCalledWith({ prioritaet: 'hoch' });
  });

  it('kategorie: Auswahl aus aktiven Werten patcht', () => {
    const onPatch = vi.fn();
    const kategorienListe = {
      werte: [
        { id: 'k1', key: 'sanitaer', label: 'Sanitär', ist_aktiv: true, reihenfolge: 0 },
        { id: 'k2', key: 'elektro', label: 'Elektro', ist_aktiv: true, reihenfolge: 1 },
      ],
    } as unknown as AuswahllisteRead;
    render(
      <div>{renderDetailFeld('kategorie', makeCtx({ onPatch, kategorienListe }))}</div>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'elektro' } });
    expect(onPatch).toHaveBeenCalledWith({ kategorie: 'elektro' });
  });

  it('quelle: Leerauswahl patcht quelle=null', () => {
    const onPatch = vi.fn();
    const quellenListe = {
      werte: [
        { id: 'q1', key: 'telefon', label: 'Telefon', ist_aktiv: true, reihenfolge: 0 },
      ],
    } as unknown as AuswahllisteRead;
    render(
      <div>
        {renderDetailFeld(
          'quelle',
          makeCtx({ onPatch, quellenListe, t: mockTicket({ quelle: undefined }) }),
        )}
      </div>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onPatch).toHaveBeenCalledWith({ quelle: null });
  });

  it('pin ohne Grundriss-Stockwerk: zeigt Voraussetzungs-Hinweis statt Pin', () => {
    render(<div>{renderDetailFeld('pin', makeCtx())}</div>);
    expect(screen.getByText(/benötigt ein sichtbares Stockwerk/i)).toBeInTheDocument();
  });
});
