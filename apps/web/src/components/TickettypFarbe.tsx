// Tickettyp-Farb-Palette — Tim 2026-05-26 (Track-2-Spec §5.4).
// 8 Tailwind-Slugs als Vorlage-Farben. Mapped auf konkrete Tailwind-
// Klassen mit transparentem Background + farbiger Border + heller Text.
// Zentralisiert, damit VorlagenPage, FarbPicker und TicketErfassenModal
// dieselbe Darstellung nutzen.

export const FARB_SLUGS = [
  'emerald',
  'blue',
  'amber',
  'rose',
  'violet',
  'teal',
  'indigo',
  'slate',
] as const;

export type FarbSlug = (typeof FARB_SLUGS)[number];

interface FarbConfig {
  /** Border + Background + Text (kombiniert) — für Karten und Badges. */
  combined: string;
  /** Hover-Variante für anklickbare Container. */
  combinedHover: string;
  /** Nur Hintergrundfarbe (für Kreis-Buttons im Picker). */
  dot: string;
}

const PALETTE: Record<FarbSlug, FarbConfig> = {
  emerald: {
    combined: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    combinedHover: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  blue: {
    combined: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    combinedHover: 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20',
    dot: 'bg-sky-500',
  },
  amber: {
    combined: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    combinedHover: 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
    dot: 'bg-amber-500',
  },
  rose: {
    combined: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    combinedHover: 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    dot: 'bg-rose-500',
  },
  violet: {
    combined: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    combinedHover: 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
    dot: 'bg-violet-500',
  },
  teal: {
    combined: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
    combinedHover: 'border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20',
    dot: 'bg-teal-500',
  },
  indigo: {
    combined: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
    combinedHover: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  slate: {
    combined: 'border-zinc-700 bg-zinc-800/40 text-zinc-300',
    combinedHover: 'border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800',
    dot: 'bg-zinc-500',
  },
};

const FALLBACK: FarbConfig = PALETTE.slate;

function resolve(farbe: string | null | undefined): FarbConfig {
  if (farbe && farbe in PALETTE) return PALETTE[farbe as FarbSlug];
  return FALLBACK;
}

/** Border + Background + Text — für statische Darstellung (Karten, Badges). */
export function farbeClass(farbe: string | null | undefined): string {
  return resolve(farbe).combined;
}

/** Border + Background + Text + Hover — für anklickbare Container. */
export function farbeClassHover(farbe: string | null | undefined): string {
  return resolve(farbe).combinedHover;
}

/** Nur Hintergrundfarbe — für Picker-Kreis-Buttons. */
export function farbeDotClass(farbe: string | null | undefined): string {
  return resolve(farbe).dot;
}
