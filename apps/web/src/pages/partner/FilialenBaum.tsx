import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

import type { PartnerHierarchieKnoten } from '../../api/types';

interface Props {
  root: PartnerHierarchieKnoten;
  /** Default-Expand-Tiefe (Spec §5.4 — Default eingeklappt nach Ebene 2). */
  defaultExpandDepth?: number;
}

/**
 * Rekursiver Filialen-Baum (Spec §5.4 / Mockup Rechte Spalte).
 *
 * - Aktueller Partner mit Punkt (●) markiert.
 * - Default eingeklappt nach Ebene 2; tiefer auf Klick.
 * - Jeder Eintrag klickt zur Filiale (Detail-Page).
 */
export function FilialenBaum({ root, defaultExpandDepth = 2 }: Props) {
  return (
    <div className="space-y-0.5 text-sm">
      <Node node={root} depth={0} defaultExpandDepth={defaultExpandDepth} />
    </div>
  );
}

function Node({
  node,
  depth,
  defaultExpandDepth,
}: {
  node: PartnerHierarchieKnoten;
  depth: number;
  defaultExpandDepth: number;
}) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 rounded px-1 py-0.5',
          node.ist_aktueller_partner ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/50',
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-4 w-4 items-center justify-center text-zinc-400 hover:text-zinc-200"
            aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="h-4 w-4" />
        )}

        <span
          className={clsx(
            'inline-block h-1.5 w-1.5 rounded-full',
            node.ist_aktueller_partner ? 'bg-emerald-400' : 'bg-transparent',
          )}
          aria-hidden
        />

        {node.ist_aktueller_partner ? (
          <span
            className={clsx(
              'truncate font-medium',
              node.gesperrt ? 'text-zinc-500 line-through' : 'text-emerald-200',
            )}
          >
            {node.name} <span className="text-[10px] text-emerald-400">(hier)</span>
          </span>
        ) : (
          <Link
            to={`/stammdaten/partner/${node.id}`}
            className={clsx(
              'truncate hover:text-emerald-300',
              node.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-300',
            )}
          >
            {node.name}
          </Link>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map((c) => (
            <Node
              key={c.id}
              node={c}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
