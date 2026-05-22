/* Mapping Kategorie-Slug → lucide-Icon (für Pool-Tabelle und Detail-Panel).
 *
 * Slugs siehe Migration 0002 + auswahlliste_service.SYSTEM_AUSWAHLLISTEN_SEED.
 * Unbekannte Slugs bekommen das Help-Icon.
 */

import {
  ArrowUpFromLine,
  Droplets,
  Flame,
  HelpCircle,
  Shield,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

const KATEGORIE_ICONS: Record<string, LucideIcon> = {
  heizung: Flame,
  sanitaer: Droplets,
  elektro: Zap,
  aufzug: ArrowUpFromLine,
  sicherheit: Shield,
  lueftung: Wind,
  klima: Wind,
  schloss: Wrench,
  allgemein: HelpCircle,
};

export function iconForKategorie(slug: string | null | undefined): LucideIcon {
  if (!slug) return HelpCircle;
  return KATEGORIE_ICONS[slug] ?? HelpCircle;
}
