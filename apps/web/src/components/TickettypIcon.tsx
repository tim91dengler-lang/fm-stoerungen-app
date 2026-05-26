// Tickettyp-Icon-Palette — Tim 2026-05-26 (Track-2-Spec §5.5).
// 15 lucide-react Icons mit FM-Relevanz. Zentralisiert, damit
// VorlagenPage, SymbolPicker und TicketErfassenModal dieselben
// Icon-Slugs interpretieren.

import {
  Activity,
  AlertTriangle,
  Binoculars,
  Building,
  Calendar,
  Droplet,
  Flame,
  Home,
  Layers,
  Lightbulb,
  type LucideIcon,
  ShieldCheck,
  Snowflake,
  Target,
  Truck,
  Wrench,
} from 'lucide-react';

export const ICON_SLUGS = [
  'wrench',
  'calendar',
  'binoculars',
  'target',
  'layers',
  'activity',
  'alert-triangle',
  'building',
  'home',
  'lightbulb',
  'droplet',
  'flame',
  'snowflake',
  'shield-check',
  'truck',
] as const;

export type IconSlug = (typeof ICON_SLUGS)[number];

const ICON_MAP: Record<IconSlug, LucideIcon> = {
  wrench: Wrench,
  calendar: Calendar,
  binoculars: Binoculars,
  target: Target,
  layers: Layers,
  activity: Activity,
  'alert-triangle': AlertTriangle,
  building: Building,
  home: Home,
  lightbulb: Lightbulb,
  droplet: Droplet,
  flame: Flame,
  snowflake: Snowflake,
  'shield-check': ShieldCheck,
  truck: Truck,
};

/** Liefert die lucide-Icon-Komponente zum Slug; fällt auf Wrench zurück.
 *
 * Auch alte Slugs aus früheren Migrations (z.B. 'binoculars'/'target' für
 * Baubegehung) werden unterstützt — sie sind in ICON_SLUGS enthalten. */
export function iconFor(slug: string | null | undefined): LucideIcon {
  if (slug && slug in ICON_MAP) return ICON_MAP[slug as IconSlug];
  return Wrench;
}
