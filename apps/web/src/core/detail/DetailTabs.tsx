import { useId, useRef, useState } from 'react';

/**
 * Reiter-Leiste + Panel fürs Detail-Overlay (Master-Layout-Standard §5.2, Reiter-
 * Modell ab 2026-06-02). Top-Navigation des Details: „Übersicht" + eigene Reiter
 * für große Feld-Kategorien + Verknüpfungs-/Chat-Reiter. Immer alle Reiter oben
 * sichtbar, Klick (oder Pfeiltasten) schaltet den Inhalt um.
 *
 * **Lazy by construction:** Es wird nur der **aktive** Reiter gerendert (`render()`
 * nur für den aktiven Tab aufgerufen). Ein Verknüpfungs-Reiter, dessen `render`
 * eine Komponente mit eigenem `useQuery` liefert, lädt seine Daten also erst beim
 * ersten Öffnen — und wird beim Wegschalten ausgehängt (leichtes DOM; React-Query
 * cached, Re-Open ist sofort).
 *
 * A11y: ARIA-Tabs (role=tablist/tab/tabpanel, aria-selected/-controls/-labelledby),
 * Roving-Tabindex + Pfeil/Home/End-Navigation. Module liefern nur die Reiter-
 * Definition — keine Navigations-Logik im Modul.
 */
export interface DetailTab {
  key: string;
  label: string;
  /** Zähler am Reiter (z. B. Verknüpfungs-Anzahl). Aus dem Datensatz, NICHT durch Vorab-Laden der Liste. */
  count?: number;
  /** Verknüpfungs-/Listen-Reiter (emerald-Akzent + ↗). */
  isRelation?: boolean;
  /** Wird nur aufgerufen, wenn dieser Reiter aktiv ist (Lazy-Mount). */
  render: () => React.ReactNode;
}

export function DetailTabs({ tabs, initialKey }: { tabs: DetailTab[]; initialKey?: string }) {
  const [active, setActive] = useState(initialKey ?? tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const baseId = useId();
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = tabs.findIndex((t) => t.key === current?.key);
    if (idx < 0 || tabs.length === 0) return;
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const key = tabs[next]!.key;
    setActive(key);
    btnRefs.current[key]?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Detailbereiche"
        onKeyDown={onKeyDown}
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 px-3"
      >
        {tabs.map((t) => {
          const selected = t.key === current?.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                btnRefs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={tabId(t.key)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={
                'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors lg:min-h-0 lg:py-2.5 ' +
                (selected
                  ? 'border-emerald-500 font-medium text-zinc-100'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200')
              }
            >
              <span>{t.label}</span>
              {t.count != null && (
                <span
                  className={
                    'rounded-full px-1.5 text-[11px] ' +
                    (selected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-zinc-800 text-zinc-400')
                  }
                >
                  {t.count}
                </span>
              )}
              {t.isRelation && (
                <span aria-hidden className={selected ? 'text-emerald-300' : 'text-emerald-500/70'}>
                  ↗
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={current ? tabId(current.key) : undefined}
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col overflow-hidden focus:outline-none"
      >
        {current?.render()}
      </div>
    </>
  );
}
