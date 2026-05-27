import clsx from 'clsx';
import {
  Briefcase,
  Building2,
  FileText,
  Files,
  Ticket as TicketIcon,
  User,
} from 'lucide-react';

export type PartnerTabKey =
  | 'allgemein'
  | 'kontakte'
  | 'objekte'
  | 'projekte'
  | 'tickets'
  | 'dokumente';

interface TabDef {
  key: PartnerTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { key: 'allgemein', label: 'Allgemein', icon: FileText },
  { key: 'kontakte', label: 'Kontakte', icon: User },
  { key: 'objekte', label: 'Objekte', icon: Building2 },
  { key: 'projekte', label: 'Projekte', icon: Briefcase },
  { key: 'tickets', label: 'Tickets', icon: TicketIcon },
  { key: 'dokumente', label: 'Dokumente', icon: Files },
];

interface Props {
  active: PartnerTabKey;
  onChange: (next: PartnerTabKey) => void;
}

export function PartnerDetailTabBar({ active, onChange }: Props) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex flex-wrap gap-1 px-2 lg:px-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={clsx(
                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
