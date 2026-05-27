import type { UUID } from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';
import { MultiSelectCombobox } from '../../components/MultiSelectCombobox';

interface Props {
  value: UUID[];
  onChange: (next: UUID[]) => void;
  lookup: PartnerTypLookup;
  /** Wenn `true`: nur Anzeige (Read-only-Mode), keine Combobox. */
  readOnly?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Multi-Select für die `partner_typ`-Auswahlliste.
 *
 * - Read-only: Chips mit Labels.
 * - Edit: `MultiSelectCombobox` (Dropdown mit Suche, Chips als Anzeige).
 *
 * Track 3 / Polish-Feedback 2026-05-26: Tim wollte Dropdown statt Toggle-
 * Pills. Die Combobox kommt aus `components/MultiSelectCombobox` und ist
 * für weitere Multi-Select-Felder (Rollen am Kontakt etc.) wiederverwendbar.
 */
export function TypenMultiSelect({
  value,
  onChange,
  lookup,
  readOnly = false,
  size = 'sm',
}: Props) {
  if (readOnly) {
    if (value.length === 0) {
      return <span className="text-xs text-zinc-500">— keine —</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((id) => {
          const label = lookup.labelFor(id);
          if (!label) return null;
          return (
            <span
              key={id}
              className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  if (lookup.werte.length === 0) {
    return (
      <span className="text-xs text-zinc-500">
        Keine Typen in der Auswahlliste — bitte unter Stammdaten → Auswahllisten
        pflegen.
      </span>
    );
  }

  return (
    <MultiSelectCombobox
      value={value}
      onChange={onChange}
      options={lookup.werte.map((w) => ({
        value: w.id,
        label: w.label,
        farbe: w.farbe,
      }))}
      placeholder="Typ wählen …"
      size={size}
    />
  );
}
