import { EntitySearchSelect, type SearchOption } from '../EntitySearchSelect';

/**
 * Geteilte Feld-Primitive für Ticket-Detail (Alt-Pfad + Engine-Registry, Stufe C).
 * 1:1 aus TicketDetailPanel extrahiert — identisches Markup, damit der Alt-Pfad
 * verhaltensgleich bleibt und die Engine dieselben Bausteine nutzt (DRY, kein Drift).
 */

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Editierbares Select für die Stammdaten-Sektion (Label + optionales Icon + Pflicht-Stern). */
export function FeldSelect({
  label,
  value,
  onChange,
  children,
  disabled = false,
  pflicht = false,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  pflicht?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        {icon}
        {label}
        {pflicht && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

/** Wie FeldSelect, aber mit serverseitiger Such-Auswahl (Bewegungsdaten). */
export function FeldSearchSelect({
  label,
  value,
  initialLabel,
  onChange,
  fetcher,
  queryKey,
  placeholder,
  pflicht = false,
  icon,
}: {
  label: string;
  value: string;
  initialLabel: string | null;
  onChange: (id: string | null) => void;
  fetcher: (search: string) => Promise<SearchOption[]>;
  queryKey: string;
  placeholder?: string;
  pflicht?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        {icon}
        {label}
        {pflicht && <span className="text-red-400">*</span>}
      </label>
      <div className="mt-1">
        <EntitySearchSelect
          value={value || null}
          initialLabel={initialLabel}
          onChange={(id) => onChange(id)}
          fetcher={fetcher}
          queryKey={queryKey}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
