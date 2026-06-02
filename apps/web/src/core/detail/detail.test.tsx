import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailBlock } from './DetailBlock';
import { RelationList } from './RelationList';
import { DetailOverlay } from './DetailOverlay';

afterEach(cleanup);

describe('DetailBlock', () => {
  it('rendert Titel, Zähler und Kinder', () => {
    render(
      <DetailBlock title="Stammdaten" count={3} defaultOpen>
        <span>Inhalt</span>
      </DetailBlock>,
    );
    expect(screen.getByText('Stammdaten')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Inhalt')).toBeTruthy();
  });

  it('zeigt das Verknüpfung-Tag bei isRelation', () => {
    render(
      <DetailBlock title="Tickets" isRelation>
        x
      </DetailBlock>,
    );
    expect(screen.getByText('Verknüpfung')).toBeTruthy();
  });
});

describe('RelationList', () => {
  const items = [
    { id: '1', label: '#1042 Heizung' },
    { id: '2', label: '#1041 Tor' },
    { id: '3', label: '#1039 Hahn' },
    { id: '4', label: '#1037 Aufzug' },
    { id: '5', label: '#1031 Licht' },
  ];

  it('zeigt nur die Vorschau (previewCount) + „alle N öffnen" bei Überhang', () => {
    const onOpen = vi.fn();
    render(<RelationList items={items} total={47} onOpenList={onOpen} previewCount={4} />);
    // 4 Vorschau-Zeilen sichtbar, die 5. nicht
    expect(screen.getByText('#1037 Aufzug')).toBeTruthy();
    expect(screen.queryByText('#1031 Licht')).toBeNull();
    const btn = screen.getByText(/alle 47 in Listenansicht öffnen/);
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('zeigt leeren Zustand', () => {
    render(<RelationList items={[]} total={0} onOpenList={() => {}} emptyLabel="nix da" />);
    expect(screen.getByText('nix da')).toBeTruthy();
  });
});

describe('DetailOverlay', () => {
  it('rendert nur wenn open', () => {
    const { rerender } = render(
      <DetailOverlay open={false} onClose={() => {}}>
        <span>Body</span>
      </DetailOverlay>,
    );
    expect(screen.queryByText('Body')).toBeNull();
    rerender(
      <DetailOverlay open onClose={() => {}}>
        <span>Body</span>
      </DetailOverlay>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('schließt bei Escape', () => {
    const onClose = vi.fn();
    render(
      <DetailOverlay open onClose={onClose}>
        <span>Body</span>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
