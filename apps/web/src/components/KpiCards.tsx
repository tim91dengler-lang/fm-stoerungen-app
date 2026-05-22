import { type LucideIcon } from 'lucide-react';

export interface KpiItem {
  label: string;
  wert: number | string;
  sub: string;
  icon: LucideIcon;
  accent: 'emerald' | 'amber' | 'red' | 'zinc' | 'sky';
}

const accentMap: Record<KpiItem['accent'], string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  sky: 'text-sky-400',
  zinc: 'text-zinc-400',
};

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                {it.label}
              </span>
              <Icon className={`h-4 w-4 ${accentMap[it.accent]}`} />
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {it.wert}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{it.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
