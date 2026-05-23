import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Target,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import { tickettypApi } from '../api/endpoints';
import type { TickettypFeldRead, TickettypFeldUpdate, TickettypRead } from '../api/types';

const ICON_MAP: Record<string, typeof Wrench> = {
  wrench: Wrench,
  calendar: Calendar,
  binoculars: Target,
  target: Target,
  layers: Layers,
};

function iconFor(name: string | null) {
  if (name && name.toLowerCase() in ICON_MAP) return ICON_MAP[name.toLowerCase()] ?? Wrench;
  return Wrench;
}

function farbeClass(farbe: string | null): string {
  switch (farbe) {
    case 'emerald':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'blue':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-300';
    case 'amber':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    default:
      return 'border-zinc-700 bg-zinc-800/40 text-zinc-300';
  }
}

export function VorlagenPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['tickettypen'],
    queryFn: () => tickettypApi.list(),
  });

  const updateFelder = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TickettypFeldUpdate[] }) =>
      tickettypApi.updateFelder(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickettypen'] }),
  });

  function toggleSichtbar(tt: TickettypRead, feld: TickettypFeldRead) {
    updateFelder.mutate({
      id: tt.id,
      payload: [{ feld_key: feld.feld_key, sichtbar: !feld.sichtbar }],
    });
  }
  function togglePflicht(tt: TickettypRead, feld: TickettypFeldRead) {
    updateFelder.mutate({
      id: tt.id,
      payload: [{ feld_key: feld.feld_key, pflicht: !feld.pflicht }],
    });
  }
  function moveFeld(tt: TickettypRead, feld: TickettypFeldRead, direction: -1 | 1) {
    const sorted = [...tt.felder].sort((a, b) => a.reihenfolge - b.reihenfolge);
    const idx = sorted.findIndex((f) => f.id === feld.id);
    const target = idx + direction;
    if (target < 0 || target >= sorted.length) return;
    const swap = sorted[target];
    if (!swap) return;
    updateFelder.mutate({
      id: tt.id,
      payload: [
        { feld_key: feld.feld_key, reihenfolge: swap.reihenfolge },
        { feld_key: swap.feld_key, reihenfolge: feld.reihenfolge },
      ],
    });
  }

  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
          <Layers className="h-5 w-5 text-emerald-400" /> Vorlagen / Tickettypen
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Pro Tickettyp festlegen, welche System-Felder sichtbar und welche Pflicht sind.
          Die Reihenfolge bestimmt die Anzeige im Erfassungs-Modal. Custom-Felder folgen
          in einer späteren Iteration.
        </p>
      </div>

      {listQuery.isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Lade Vorlagen …</div>
      )}

      <div className="space-y-3">
        {listQuery.data?.map((tt) => {
          const Icon = iconFor(tt.icon);
          const isOpen = openId === tt.id;
          const sortedFelder = [...tt.felder].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const visibleCount = sortedFelder.filter((f) => f.sichtbar).length;
          const pflichtCount = sortedFelder.filter((f) => f.sichtbar && f.pflicht).length;
          return (
            <div
              key={tt.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : tt.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                )}
                <span
                  className={clsx(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                    farbeClass(tt.farbe),
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-zinc-100">{tt.label}</div>
                  {tt.beschreibung && (
                    <div className="text-xs text-zinc-500">{tt.beschreibung}</div>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
                    {visibleCount} sichtbar
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
                    {pflichtCount} Pflicht
                  </span>
                  {tt.ist_system && (
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
                      System
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800 px-4 py-3">
                  <div className="mb-2 grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <div className="col-span-1"></div>
                    <div className="col-span-5">Feld</div>
                    <div className="col-span-2">Sichtbar</div>
                    <div className="col-span-2">Pflicht</div>
                    <div className="col-span-2">Position</div>
                  </div>
                  <div className="space-y-1">
                    {sortedFelder.map((f, idx) => (
                      <div
                        key={f.id}
                        className={clsx(
                          'grid grid-cols-12 items-center gap-2 rounded-md border px-2 py-2 text-sm',
                          f.sichtbar
                            ? 'border-zinc-800 bg-zinc-950/40'
                            : 'border-zinc-800 bg-zinc-950/20 opacity-60',
                        )}
                      >
                        <div className="col-span-1 text-zinc-600">
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>
                        <div className="col-span-5">
                          <div className="font-medium text-zinc-200">{f.label}</div>
                          <div className="font-mono text-[10px] text-zinc-500">
                            {f.feld_key}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <button
                            type="button"
                            onClick={() => toggleSichtbar(tt, f)}
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                              f.sichtbar
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-zinc-800 text-zinc-400',
                            )}
                          >
                            {f.sichtbar ? (
                              <>
                                <Eye className="h-3 w-3" /> Sichtbar
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" /> Versteckt
                              </>
                            )}
                          </button>
                        </div>
                        <div className="col-span-2">
                          <button
                            type="button"
                            onClick={() => togglePflicht(tt, f)}
                            disabled={!f.sichtbar}
                            className={clsx(
                              'rounded-md px-2 py-1 text-xs',
                              f.pflicht
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-zinc-800 text-zinc-400',
                              !f.sichtbar && 'cursor-not-allowed opacity-40',
                            )}
                          >
                            {f.pflicht ? 'Pflicht' : 'Optional'}
                          </button>
                        </div>
                        <div className="col-span-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveFeld(tt, f, -1)}
                            disabled={idx === 0}
                            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                            aria-label="Nach oben"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFeld(tt, f, 1)}
                            disabled={idx === sortedFelder.length - 1}
                            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                            aria-label="Nach unten"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
