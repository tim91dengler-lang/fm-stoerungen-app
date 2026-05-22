interface Props {
  fullName: string | null | undefined;
  /** xs = 5x5, sm = 6x6, md = 7x7 (default), lg = 8x8 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Hex/Tailwind-Klasse für die Hintergrund-Tönung; default = Emerald. */
  tone?: 'emerald' | 'sky' | 'amber' | 'slate' | 'rose';
}

const sizeClasses = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-[11px]',
  lg: 'h-8 w-8 text-xs',
} as const;

const toneClasses = {
  emerald: 'bg-emerald-500/20 text-emerald-300',
  sky: 'bg-sky-500/20 text-sky-300',
  amber: 'bg-amber-500/20 text-amber-300',
  slate: 'bg-zinc-700/50 text-zinc-300',
  rose: 'bg-rose-500/20 text-rose-300',
} as const;

export function initialsFor(fullName: string | null | undefined): string {
  if (!fullName) return '—';
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '—';
}

export function InitialAvatar({
  fullName,
  size = 'md',
  tone = 'emerald',
}: Props) {
  return (
    <span
      className={`flex items-center justify-center rounded-md font-semibold ${sizeClasses[size]} ${toneClasses[tone]}`}
      title={fullName ?? undefined}
    >
      {initialsFor(fullName)}
    </span>
  );
}
