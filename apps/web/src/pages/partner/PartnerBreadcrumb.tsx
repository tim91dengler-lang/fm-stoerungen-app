import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import clsx from 'clsx';

import type { PartnerHierarchieKnoten } from '../../api/types';

interface Props {
  /** Wurzel-Knoten aus GET /partner/{id}/hierarchie. */
  root: PartnerHierarchieKnoten | null | undefined;
  /** ID des aktuell offenen Partners — für die Suche im Baum. */
  currentPartnerId: string;
}

/**
 * Breadcrumb-Pfad über den Tabs (Track 3 Polish 2026-05-26).
 *
 * Zeigt z. B.: `Boutique Stein › Niederlassung Stuttgart`.
 * Jeder Vorfahre ist klickbar (Link zur jeweiligen Partner-Detail-Page),
 * der aktuelle Partner ist hervorgehoben und nicht klickbar.
 *
 * Findet den Pfad zur aktuellen Partner-ID per DFS im Hierarchie-Baum.
 */
export function PartnerBreadcrumb({ root, currentPartnerId }: Props) {
  const path = root ? findPath(root, currentPartnerId) : [];

  if (path.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Partner-Pfad"
      className="flex flex-wrap items-center gap-1 px-4 py-2 text-xs text-zinc-400 lg:px-8"
    >
      <Link
        to="/stammdaten/partner"
        className="inline-flex items-center gap-1 hover:text-zinc-200"
      >
        <Home className="h-3 w-3" />
        Geschäftspartner
      </Link>
      {path.map((node, idx) => {
        const isLast = idx === path.length - 1;
        return (
          <span key={node.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            {isLast ? (
              <span
                className={clsx(
                  'font-medium',
                  node.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-200',
                )}
                aria-current="page"
              >
                {node.name}
              </span>
            ) : (
              <Link
                to={`/stammdaten/partner/${node.id}`}
                className={clsx(
                  'hover:text-emerald-300',
                  node.gesperrt && 'text-zinc-500 line-through',
                )}
              >
                {node.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function findPath(
  node: PartnerHierarchieKnoten,
  targetId: string,
): PartnerHierarchieKnoten[] {
  if (node.id === targetId) return [node];
  for (const child of node.children) {
    const sub = findPath(child, targetId);
    if (sub.length > 0) return [node, ...sub];
  }
  return [];
}
