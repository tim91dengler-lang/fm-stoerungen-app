import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Navigations-Schicht fürs Detail-Overlay (Master-Layout-Standard §5.2):
 * verdrahtet die Sprung-Chips im Kopf mit den Block-Sektionen im Body. Drei
 * Aufgaben, alle EINMAL hier statt pro Modul:
 *
 *  1. **Springen** — Klick auf einen Feld-Chip scrollt zum Block IM
 *     Scroll-Container (nicht im Fenster) und klappt ihn auf.
 *  2. **Garantiertes Feedback** — der Zielblock blitzt kurz auf
 *     (`animate-detail-flash`). Das ist der entscheidende Teil: passt der
 *     ganze Inhalt ins Fenster (Normalfall Desktop), bewegt der Scroll 0 px —
 *     der Flash zeigt trotzdem sichtbar, dass der Klick ankam.
 *  3. **Orientierung** — ein Scroll-Spy (IntersectionObserver, root =
 *     Container) markiert permanent den Chip des gerade sichtbaren Blocks.
 *
 * Module liefern nur deklarativ `chips` (mit `blockKey`/`activeKey`) und
 * `DetailBlock`s (mit stabilem `blockKey`) — kein Navigations-Code im Modul.
 */

interface DetailNavValue {
  /** Aktuell per Scroll-Spy sichtbarer Block (für Chip-Aktiv-Zustand). */
  activeBlock: string | null;
  /** Springt zum Block: aufklappen + scrollen + Flash + aktiv setzen. */
  scrollToBlock: (key: string) => void;
}

const DetailNavContext = createContext<DetailNavValue | null>(null);

/** Liest die Navigations-API (Kopf-Chips, Block-Flash). */
export function useDetailNav(): DetailNavValue {
  const ctx = useContext(DetailNavContext);
  // Fallback (No-Op), falls ein DetailHeader ohne Provider gerendert wird
  // (z. B. isolierter Test) — dann sind Chips einfach statisch.
  return ctx ?? NOOP;
}

const NOOP: DetailNavValue = { activeBlock: null, scrollToBlock: () => {} };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Kurzes, sich selbst aufräumendes Feedback am Zielblock — hinterlässt KEINE
 * bleibende Markierung (sonst sammeln sich grüne Ränder an allen je
 * angesprungenen Blöcken an). Mit Bewegung: CSS-Box-Shadow-Puls, der sich nach
 * `animationend` selbst entfernt. Bei `prefers-reduced-motion`: ein statisches,
 * kurzes Aufleuchten ohne Animation, per Timeout zurückgesetzt.
 */
function flashBlock(el: HTMLElement, reduce: boolean) {
  if (reduce) {
    el.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.6)';
    window.setTimeout(() => {
      el.style.boxShadow = '';
    }, 650);
    return;
  }
  el.classList.remove('animate-detail-flash');
  void el.offsetWidth; // Reflow erzwingen → Animation startet auch bei Wiederholung neu
  el.classList.add('animate-detail-flash');
  el.addEventListener('animationend', () => el.classList.remove('animate-detail-flash'), {
    once: true,
  });
}

interface ScrollCtx {
  scrollRef: React.RefObject<HTMLDivElement>;
  setActiveBlock: (key: string | null) => void;
}
const ScrollContext = createContext<ScrollCtx | null>(null);

/**
 * Provider um Kopf + Body. Hält den Scroll-Container-Ref und den Aktiv-Block,
 * stellt `scrollToBlock` bereit. Muss BEIDE umschließen (DetailHeader UND
 * DetailScroll), weil der Kopf außerhalb des scrollenden Body liegt.
 */
export function DetailNavProvider({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);

  const scrollToBlock = useCallback((key: string) => {
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLDetailsElement>(`[data-block="${CSS.escape(key)}"]`);
    if (!el) return;
    const reduce = prefersReducedMotion();
    el.open = true;
    setActiveBlock(key);
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    flashBlock(el, reduce);
  }, []);

  const navValue = useMemo<DetailNavValue>(
    () => ({ activeBlock, scrollToBlock }),
    [activeBlock, scrollToBlock],
  );
  const scrollValue = useMemo<ScrollCtx>(() => ({ scrollRef, setActiveBlock }), []);

  return (
    <DetailNavContext.Provider value={navValue}>
      <ScrollContext.Provider value={scrollValue}>{children}</ScrollContext.Provider>
    </DetailNavContext.Provider>
  );
}

/**
 * Scrollender Body des Detail-Overlays. Hält den Container-Ref (Sprungziel)
 * und betreibt den Scroll-Spy. `ready` erst auf `true` setzen, wenn die
 * Block-Sektionen im DOM sind (nach dem Datenladen) — sonst findet der
 * Observer nichts.
 */
export function DetailScroll({
  children,
  ready = true,
  className,
}: {
  children: React.ReactNode;
  ready?: boolean;
  className?: string;
}) {
  const ctx = useContext(ScrollContext);
  const scrollRef = ctx?.scrollRef;
  const setActiveBlock = ctx?.setActiveBlock;

  useEffect(() => {
    const root = scrollRef?.current;
    if (!ready || !root || !setActiveBlock) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-block]'));
    if (blocks.length === 0) return;

    // Obere ~35 % des Containers sind die „Lesezone": sobald ein Block dort
    // einläuft, gilt er als aktiv. So schaltet der Aktiv-Chip früh um.
    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target as HTMLElement);
          else visible.delete(e.target as HTMLElement);
        }
        // Obersten sichtbaren Block wählen. Im Desktop-Zweispalter (DetailRegions
        // ab lg:) konkurrieren linke und rechte Spalte um den obersten Platz —
        // darum top in 48px-Bänder bucketn und innerhalb eines Bandes die linke
        // (primäre) Spalte bevorzugen, sonst flackert der Aktiv-Chip zwischen
        // den Spalten.
        const top = [...visible]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .sort((a, b) => {
            const ba = Math.round(a.r.top / 48);
            const bb = Math.round(b.r.top / 48);
            return ba !== bb ? ba - bb : a.r.left - b.r.left;
          })[0]?.el;
        if (top) setActiveBlock(top.getAttribute('data-block'));
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, [ready, scrollRef, setActiveBlock]);

  return (
    <div ref={scrollRef} className={className ?? 'min-h-0 flex-1 overflow-y-auto px-5 py-4'}>
      {children}
    </div>
  );
}
