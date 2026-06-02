import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DatePicker } from '../../components/DatePicker';
import { DetailBlock } from './DetailBlock';
import { DetailHeader } from './DetailHeader';
import { DetailNavProvider, DetailScroll } from './DetailNav';
import { DetailTabs } from './DetailTabs';
import { InlineEditMulti, InlineEditSelect, InlineEditText } from './InlineEdit';
import { RelationList } from './RelationList';
import { RelationListTab } from './RelationListTab';
import { RelationListView } from './RelationListView';
import { DetailOverlay } from './DetailOverlay';

afterEach(cleanup);

/** Wrapper für Komponenten, die `useQuery` nutzen (EntitySearchSelect-basierte Picker). */
function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

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
    render(
      <RelationList items={items} total={47} onOpenList={onOpen} previewCount={4} />,
    );
    // 4 Vorschau-Zeilen sichtbar, die 5. nicht
    expect(screen.getByText('#1037 Aufzug')).toBeTruthy();
    expect(screen.queryByText('#1031 Licht')).toBeNull();
    const btn = screen.getByText(/alle 47 in Listenansicht öffnen/);
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('zeigt leeren Zustand', () => {
    render(
      <RelationList items={[]} total={0} onOpenList={() => {}} emptyLabel="nix da" />,
    );
    expect(screen.getByText('nix da')).toBeTruthy();
  });

  it('feuert onItemClick beim Klick auf eine Vorschau-Zeile', () => {
    const onItem = vi.fn();
    render(
      <RelationList items={items} total={5} onOpenList={() => {}} onItemClick={onItem} />,
    );
    fireEvent.click(screen.getByText('#1042 Heizung'));
    expect(onItem).toHaveBeenCalledWith('1');
  });
});

describe('Detail-Navigation (Sprung-Chips)', () => {
  function Harness() {
    return (
      <DetailNavProvider>
        <DetailHeader
          title="Projekt X"
          chips={[
            { label: 'Stammdaten', blockKey: 'stammdaten' },
            { label: 'Termine', blockKey: 'termine' },
          ]}
          onClose={() => {}}
        />
        <DetailScroll>
          <DetailBlock title="Stammdaten" blockKey="stammdaten">
            <span>S-Inhalt</span>
          </DetailBlock>
          <DetailBlock title="Termine" blockKey="termine">
            <span>T-Inhalt</span>
          </DetailBlock>
        </DetailScroll>
      </DetailNavProvider>
    );
  }

  it('Chip-Klick klappt den Zielblock auf, blitzt ihn an und markiert den Chip aktiv', () => {
    const scrollSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {});
    render(<Harness />);
    const chip = screen.getByRole('button', { name: 'Stammdaten' });
    const block = document.querySelector(
      '[data-block="stammdaten"]',
    ) as HTMLDetailsElement;
    expect(block.open).toBe(false);

    fireEvent.click(chip);

    expect(block.open).toBe(true);
    expect(block.classList.contains('animate-detail-flash')).toBe(true);
    expect(scrollSpy).toHaveBeenCalled();
    expect(chip).toHaveAttribute('aria-current', 'true');
    scrollSpy.mockRestore();
  });

  it('Scroll-Spy markiert den sichtbaren Block; im Zweispalter gewinnt die linke Spalte', () => {
    // Aufzeichnender IntersectionObserver: hält die Callback, damit der Test
    // Sichtbarkeit simulieren kann (jsdom feuert sonst nie).
    const callbacks: IntersectionObserverCallback[] = [];
    class CapturingIO {
      root = null;
      rootMargin = '';
      thresholds = [];
      constructor(cb: IntersectionObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', CapturingIO);

    render(<Harness />);
    const sd = document.querySelector('[data-block="stammdaten"]') as HTMLElement;
    const tm = document.querySelector('[data-block="termine"]') as HTMLElement;
    // Termine (rechte Spalte) minimal höher, aber im selben 48px-Band → linke
    // Spalte (Stammdaten, left=0) muss gewinnen.
    vi.spyOn(sd, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
    } as DOMRect);
    vi.spyOn(tm, 'getBoundingClientRect').mockReturnValue({
      top: 90,
      left: 500,
    } as DOMRect);

    expect(callbacks).toHaveLength(1);
    const fire = callbacks[0]!;
    act(() => {
      fire(
        [
          { target: sd, isIntersecting: true },
          { target: tm, isIntersecting: true },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByRole('button', { name: 'Stammdaten' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Termine' })).not.toHaveAttribute(
      'aria-current',
    );

    vi.unstubAllGlobals();
  });
});

describe('DetailTabs', () => {
  it('zeigt nur den aktiven Reiter; Klick schaltet um (Lazy-Render)', () => {
    const renderA = vi.fn(() => <div>Inhalt A</div>);
    const renderB = vi.fn(() => <div>Inhalt B</div>);
    render(
      <DetailTabs
        tabs={[
          { key: 'a', label: 'Alpha', render: renderA },
          { key: 'b', label: 'Beta', count: 3, isRelation: true, render: renderB },
        ]}
      />,
    );
    // Initial: A aktiv und gerendert, B noch NICHT (lazy)
    expect(screen.getByText('Inhalt A')).toBeTruthy();
    expect(screen.queryByText('Inhalt B')).toBeNull();
    expect(renderB).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Reiter „Beta" klicken → B rendert, A ist weg
    fireEvent.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(screen.getByText('Inhalt B')).toBeTruthy();
    expect(screen.queryByText('Inhalt A')).toBeNull();
    expect(renderB).toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('Pfeiltasten schalten den Reiter um (Roving-Tabindex)', () => {
    render(
      <DetailTabs
        tabs={[
          { key: 'a', label: 'Alpha', render: () => <div>Inhalt A</div> },
          { key: 'b', label: 'Beta', render: () => <div>Inhalt B</div> },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Inhalt B')).toBeTruthy();
  });
});

describe('RelationListView', () => {
  const columns = [{ key: 'name', label: 'Objekt' }];
  const rows = [
    { id: '1', search: 'wohnpark heilbronner', cells: ['Wohnpark Heilbronner'] },
    { id: '2', search: 'bürohaus marktplatz', cells: ['Bürohaus Marktplatz'] },
  ];

  it('filtert per Suche und feuert onRowClick', () => {
    const onRow = vi.fn();
    render(<RelationListView columns={columns} rows={rows} onRowClick={onRow} />);
    expect(screen.getByText('Wohnpark Heilbronner')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/suchen/i), {
      target: { value: 'büro' },
    });
    expect(screen.queryByText('Wohnpark Heilbronner')).toBeNull();
    expect(screen.getByText('Bürohaus Marktplatz')).toBeTruthy();

    fireEvent.click(screen.getByText('Bürohaus Marktplatz'));
    expect(onRow).toHaveBeenCalledWith('2');
  });

  it('zeigt leeren Zustand', () => {
    render(<RelationListView columns={columns} rows={[]} emptyLabel="nichts da" />);
    expect(screen.getByText('nichts da')).toBeTruthy();
  });

  it('kennzeichnet eine serverseitig gekappte Liste ehrlich im Zähler', () => {
    // 2 geladene Zeilen, aber 500 gesamt → Suche kann nur die 2 erreichen.
    render(<RelationListView columns={columns} rows={rows} total={500} />);
    expect(screen.getByText(/2 geladen \(von 500\)/)).toBeTruthy();
  });
});

describe('InlineEdit', () => {
  it('Text: Klick → ändern → Enter speichert', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditText label="Projektname" value="alt" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: /Projektname bearbeiten/ }));
    const input = screen.getByDisplayValue('alt');
    fireEvent.change(input, { target: { value: 'neu' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('neu'));
  });

  it('Text: Esc bricht ab (kein Commit, zurück in Leseansicht)', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditText label="Projektname" value="alt" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: /Projektname bearbeiten/ }));
    const input = screen.getByDisplayValue('alt');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Projektname bearbeiten/ })).toBeTruthy();
  });

  it('Text: keine Änderung → kein Commit beim Wegklicken', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditText label="Projektname" value="alt" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: /Projektname bearbeiten/ }));
    fireEvent.blur(screen.getByDisplayValue('alt'));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Text required: leeren → revertiert ohne Commit', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditText label="Projektname" value="alt" required onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Projektname bearbeiten/ }));
    const input = screen.getByDisplayValue('alt');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Projektname bearbeiten/ })).toBeTruthy();
  });

  it('Select: Auswahl über den gestylten Picker speichert', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <InlineEditSelect
        label="Status"
        value="geplant"
        queryKey="test-status"
        options={[
          { value: 'geplant', label: 'Geplant' },
          { value: 'aktiv', label: 'Aktiv' },
        ]}
        onCommit={onCommit}
      />,
    );
    // Picker zeigt aktuellen Wert; Klick öffnet das Dropdown (kein natives <select>)
    fireEvent.click(screen.getByRole('button', { name: /Geplant/ }));
    const aktiv = await screen.findByRole('button', { name: 'Aktiv' });
    fireEvent.click(aktiv);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('aktiv'));
  });
});

describe('RelationListTab', () => {
  interface Row {
    id: string;
    name: string;
  }
  const cols = [{ id: 'name', accessorKey: 'name', header: 'Objekt' }] as never;
  const data: Row[] = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
  ];

  it('rendert die echte Liste und filtert per Volltextsuche', () => {
    render(
      <RelationListTab<Row>
        viewKey="test-rel"
        columns={cols}
        data={data}
        getSearchText={(r) => r.name}
        searchPlaceholder="Volltextsuche …"
      />,
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Volltextsuche …'), {
      target: { value: 'alp' },
    });
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('Multi: zeigt die gewählten Werte als Chips', () => {
    render(
      <InlineEditMulti
        label="Typen"
        value={['a']}
        options={[
          { value: 'a', label: 'Eigentümer' },
          { value: 'b', label: 'Mieter' },
        ]}
        onCommit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText('Eigentümer')).toBeTruthy();
  });
});

describe('DatePicker', () => {
  it('öffnet den Kalender und wählt einen Tag (ISO)', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /15\.06\.2026/ }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith('2026-06-20');
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
