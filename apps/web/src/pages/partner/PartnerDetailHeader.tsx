import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, MoreHorizontal, Pencil, Unlock, X } from 'lucide-react';
import clsx from 'clsx';

import type { PartnerRead } from '../../api/types';
import type { PartnerTypLookup } from '../../lib/usePartnerTypLookup';

interface Props {
  partner: PartnerRead;
  partnerTypLookup: PartnerTypLookup;
  editMode: boolean;
  isDirty: boolean;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onToggleSperre: (nextGesperrt: boolean) => void;
  saving: boolean;
}

/**
 * Header der Partner-Detail-Page (Spec §5.4 / Mockup-Vorbild).
 *
 * - Zurück-Link, Partner-Name groß, Typ-Badges, Status, Aktions-Menü.
 * - Im Edit-Modus statt „✎ Bearbeiten" → „Speichern" + „Verwerfen".
 * - Aktions-Menü hat „Sperren/Entsperren" (rekursiv auf Filialen).
 */
export function PartnerDetailHeader({
  partner,
  partnerTypLookup,
  editMode,
  isDirty,
  onEnterEdit,
  onCancelEdit,
  onSave,
  onToggleSperre,
  saving,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/50">
      <div className="space-y-3 px-4 py-4 lg:px-8">
        <Link
          to="/stammdaten/partner"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Liste
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={clsx(
                'text-2xl font-semibold',
                partner.gesperrt ? 'text-zinc-500 line-through' : 'text-zinc-100',
              )}
            >
              {partner.name}
            </h1>

            <div className="flex flex-wrap gap-1">
              {partner.typen.map((t) => {
                const label = partnerTypLookup.labelFor(t);
                if (!label) return null;
                return (
                  <span
                    key={t}
                    className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-xs',
                partner.gesperrt
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-zinc-800 text-zinc-400',
              )}
            >
              Status: {partner.gesperrt ? 'gesperrt' : 'aktiv'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Verwerfen
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || !isDirty}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving ? 'Speichere …' : 'Speichern'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnterEdit}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Weitere Aktionen"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleSperre(!partner.gesperrt);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    {partner.gesperrt ? (
                      <>
                        <Unlock className="h-3.5 w-3.5" /> Entsperren (rekursiv)
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Sperren (rekursiv)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
