import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Layers,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { tickettypApi } from '../api/endpoints';
import type { TickettypRead } from '../api/types';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';
import { farbeClass } from '../components/TickettypFarbe';
import { iconFor } from '../components/TickettypIcon';

export function VorlagenPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<TickettypRead | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const listQuery = useQuery({
    queryKey: ['tickettypen'],
    queryFn: () => tickettypApi.list(),
  });

  const duplicateMut = useMutation({
    mutationFn: (id: string) => tickettypApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickettypen'] }),
  });

  const toggleAktivMut = useMutation({
    mutationFn: ({ id, aktiv }: { id: string; aktiv: boolean }) =>
      tickettypApi.update(id, { aktiv }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickettypen'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => tickettypApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickettypen'] });
      setPendingDelete(null);
    },
  });

  const visibleVorlagen = useMemo(() => {
    const all = listQuery.data ?? [];
    return showInactive ? all : all.filter((tt) => tt.aktiv);
  }, [listQuery.data, showInactive]);

  const inaktivCount = useMemo(
    () => (listQuery.data ?? []).filter((tt) => !tt.aktiv).length,
    [listQuery.data],
  );

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Layers className="h-5 w-5 text-emerald-400" /> Vorlagen / Tickettypen
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Vorlagen anlegen, gestalten und konfigurieren. Pro Vorlage festlegen, welche
            System-Felder sichtbar und welche Pflicht sind, in welcher Reihenfolge sie
            erscheinen, Farbe und Symbol wählen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/stammdaten/vorlagen/neu')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Neue Vorlage
        </button>
      </div>

      {inaktivCount > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500"
            />
            Inaktive einblenden ({inaktivCount})
          </label>
        </div>
      )}

      {listQuery.isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Lade Vorlagen …</div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleVorlagen.map((tt) => (
          <VorlageKarte
            key={tt.id}
            vorlage={tt}
            onEdit={() => navigate(`/stammdaten/vorlagen/${tt.id}/bearbeiten`)}
            onDuplicate={() => duplicateMut.mutate(tt.id)}
            onToggleAktiv={() => toggleAktivMut.mutate({ id: tt.id, aktiv: !tt.aktiv })}
            onDelete={() => setPendingDelete(tt)}
            isDuplicating={duplicateMut.isPending && duplicateMut.variables === tt.id}
          />
        ))}
        {visibleVorlagen.length === 0 && !listQuery.isLoading && (
          <div className="col-span-full rounded-md border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
            Noch keine Vorlagen angelegt. Klick auf {'„Neue Vorlage"'}, um die erste anzulegen.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Vorlage löschen?"
        message={
          <>
            Die Vorlage <strong>{pendingDelete?.label}</strong> wird unwiderruflich gelöscht.
            Bestehende Tickets behalten ihre Daten, verlieren aber die Vorlage-Referenz.
          </>
        }
        confirmLabel="Löschen"
        busy={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

interface KarteProps {
  vorlage: TickettypRead;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleAktiv: () => void;
  onDelete: () => void;
  isDuplicating: boolean;
}

function VorlageKarte({
  vorlage,
  onEdit,
  onDuplicate,
  onToggleAktiv,
  onDelete,
  isDuplicating,
}: KarteProps) {
  const Icon = iconFor(vorlage.icon);
  const visibleCount = vorlage.felder.filter((f) => f.sichtbar).length;
  const pflichtCount = vorlage.felder.filter((f) => f.sichtbar && f.pflicht).length;

  return (
    <div
      className={clsx(
        'group relative cursor-pointer rounded-lg border bg-zinc-900/40 p-4 transition-colors hover:bg-zinc-900/70',
        vorlage.aktiv ? 'border-zinc-800' : 'border-zinc-800 opacity-60',
      )}
      onClick={onEdit}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
            farbeClass(vorlage.farbe),
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold text-zinc-100">{vorlage.label}</div>
          </div>
          {vorlage.beschreibung && (
            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
              {vorlage.beschreibung}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              {visibleCount} sichtbar
            </span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
              {pflichtCount} Pflicht
            </span>
            {vorlage.ist_system && (
              <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
                System
              </span>
            )}
            {!vorlage.aktiv && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-zinc-300">
                Inaktiv
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Aktionen — sichtbar on hover (bzw. immer auf Touch) */}
      <div
        className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <KartenAktion
          icon={Pencil}
          label="Bearbeiten"
          onClick={onEdit}
        />
        <KartenAktion
          icon={Copy}
          label="Duplizieren"
          onClick={onDuplicate}
          busy={isDuplicating}
        />
        <KartenAktion
          icon={Power}
          label={vorlage.aktiv ? 'Deaktivieren' : 'Aktivieren'}
          onClick={onToggleAktiv}
        />
        {!vorlage.ist_system && (
          <KartenAktion
            icon={Trash2}
            label="Löschen"
            onClick={onDelete}
            tone="danger"
          />
        )}
      </div>
    </div>
  );
}

interface AktionProps {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  busy?: boolean;
  tone?: 'default' | 'danger';
}

function KartenAktion({ icon: Icon, label, onClick, busy, tone = 'default' }: AktionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={clsx(
        'rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-40',
        tone === 'danger' ? 'hover:text-red-400' : 'hover:text-zinc-200',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
