/**
 * Generische Listen-Feld-Helfer (Phase 2b, ADR 0006) — FM-frei, daher in `core/`.
 *
 * Bündelt die über die Stammdaten-Listen wiederkehrenden Spalten-/Filter-Muster an
 * EINER Stelle: ein neuer Standard (z. B. wie ein Boolean-„aktiv"-Feld aussieht/filtert)
 * wird hier einmal gepflegt statt pro Seite kopiert. Bespoke, entity-spezifische Zellen
 * (Links, Icons, Multi-Pills) bleiben bewusst in der Seite.
 *
 * Verwendung in einer Listen-Seite:
 *   // Zelle:        cell: (ctx) => boolStatusCell(ctx.row.original.aktiv)
 *   // accessor:     accessorFn: (r) => boolStatusValue(r.aktiv)   // für Filter/Gruppierung
 *   // meta:         meta: BOOL_STATUS_MASS_EDIT
 *   // filterRender: aktiv: boolStatusFilter()
 *   // Auswahlliste: cell: (ctx) => auswahllisteBadgeCell(ctx.row.original.kategorie?.label)
 *   // Datum:        filterRenderers: { faelligkeit_am: DateFilter }, filterFn: dateLteFilter
 */
import type { ReactNode } from 'react';

import { DatePicker } from '../../components/DatePicker';
import { SelectFilter, type SelectOption } from '../liste/columnFilters';

// ---------------------------------------------------------------------------
// Boolean-„Status"-Muster (z. B. aktiv/inaktiv) — Zelle + Filter + massEdit
// ---------------------------------------------------------------------------

export const BOOL_STATUS_MASS_EDIT = { massEdit: { type: 'boolean' as const } };

/** Filter-Wert (für accessorFn): Label-String, damit Spaltenfilter/Gruppierung greifen. */
export function boolStatusValue(
  on: boolean,
  trueLabel = 'aktiv',
  falseLabel = 'inaktiv',
): string {
  return on ? trueLabel : falseLabel;
}

/** Zelle: grünes Pill bei true, neutrales Pill bei false. */
export function boolStatusCell(
  on: boolean,
  trueLabel = 'aktiv',
  falseLabel = 'inaktiv',
): ReactNode {
  return on ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
      {trueLabel}
    </span>
  ) : (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
      {falseLabel}
    </span>
  );
}

/**
 * Generischer Multi-Select-Spaltenfilter aus festen Optionen — ersetzt das über
 * die Seiten wiederholte `(props) => <SelectFilter {...props} options={…} />`.
 */
export function selectFilter(options: SelectOption[]) {
  return function SelectFilterRenderer(props: {
    value: unknown;
    onChange: (v: unknown) => void;
  }): ReactNode {
    return <SelectFilter {...props} options={options} />;
  };
}

/** Filter-Renderer für das Boolean-„Status"-Muster (true/false-Labels). */
export function boolStatusFilter(trueLabel = 'aktiv', falseLabel = 'inaktiv') {
  return selectFilter([
    { value: trueLabel, label: trueLabel },
    { value: falseLabel, label: falseLabel },
  ]);
}

// ---------------------------------------------------------------------------
// Auswahllisten-/Enum-Badge-Zelle (neutrales Pill, „—" wenn leer)
// ---------------------------------------------------------------------------

export function auswahllisteBadgeCell(label: string | null | undefined): ReactNode {
  if (!label) return <span className="text-zinc-500">—</span>;
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Datum: generischer Spaltenfilter (DatePicker) + „fällig bis" (≤)-filterFn
// ---------------------------------------------------------------------------

/** Spaltenfilter für ISO-Datum (`YYYY-MM-DD`), Wert = ISO-String oder undefined. */
export function DateFilter({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}): ReactNode {
  return (
    <DatePicker
      value={typeof value === 'string' ? value : null}
      onChange={(iso) => onChange(iso || undefined)}
      placeholder="bis …"
      className="w-full"
    />
  );
}

/** filterFn: Zeile passt, wenn ihr Datum ≤ gewähltem Datum ist (leeres Datum = kein Treffer). */
export function dateLteFilter(
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: unknown,
): boolean {
  if (!filterValue) return true;
  const d = row.getValue(columnId);
  return typeof d === 'string' ? d <= (filterValue as string) : false;
}
