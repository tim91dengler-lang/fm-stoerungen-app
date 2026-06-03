import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Crown } from 'lucide-react';
import { objektApi } from '../api/endpoints';
import { ObjektStrukturEditor } from '../components/objekt/ObjektStrukturEditor';

/**
 * Objekt-Detailseite (/stammdaten/objekte/:id) — Page-Chrome um den
 * Struktur-Editor.
 *
 * Der eigentliche Editor (Häuser/Stockwerke/Einheiten) lebt seit Folge D in
 * `ObjektStrukturEditor` und wird hier identisch zum Overlay-Reiter „Struktur"
 * gerendert (eine Code-Quelle, keine Duplikation). Diese Seite steuert nur den
 * Seiten-Rahmen bei: Back-Link, Objektname/Adresse, Eigentümer-Badges.
 */
export function ObjektDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objektId = id ?? '';

  const objektQuery = useQuery({
    queryKey: ['objekt', objektId],
    queryFn: () => objektApi.get(objektId),
    enabled: !!objektId,
  });

  // Eigentümer auf Objekt-Ebene (aus partner_links extrahiert)
  const eigentuemer = useMemo(
    () =>
      (objektQuery.data?.partner_links ?? []).filter((l) => l.rolle === 'eigentuemer'),
    [objektQuery.data],
  );

  if (!objektId)
    return <div className="p-6 text-sm text-zinc-500">Kein Objekt ausgewählt.</div>;

  return (
    <div className="flex min-h-0 flex-col gap-6 px-4 py-6 lg:h-[calc(100vh-7rem)] lg:px-8">
      <div className="shrink-0">
        <Link
          to="/stammdaten/objekte"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Objekte
        </Link>
        <h1 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-zinc-100">
          <Building2 className="h-5 w-5 text-emerald-400" />
          {objektQuery.data?.name ?? '…'}
        </h1>
        {objektQuery.data?.adresse && (
          <p className="text-xs text-zinc-500">
            {objektQuery.data.adresse.strasse} {objektQuery.data.adresse.hausnummer},{' '}
            {objektQuery.data.adresse.plz} {objektQuery.data.adresse.ort}
          </p>
        )}
        {eigentuemer.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
              <Crown className="h-3 w-3" /> Eigentümer (Objekt)
            </span>
            {eigentuemer.map((p) => (
              <span
                key={p.partner_id}
                className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300"
                title={`Eigentümer: ${p.partner_name}`}
              >
                {p.partner_name}
              </span>
            ))}
          </div>
        )}
      </div>

      <ObjektStrukturEditor
        objektId={objektId}
        objektAdresseId={objektQuery.data?.adresse_id ?? null}
      />
    </div>
  );
}
