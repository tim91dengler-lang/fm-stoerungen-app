import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { auswahllistenApi } from '../api/endpoints';
import type {
  AuswahllisteRead,
  AuswahllistenWertCreate,
  AuswahllistenWertRead,
  AuswahllistenWertUpdate,
} from '../api/types';
import { ConfirmDialog } from '../core/liste/ConfirmDialog';

// Status-Liste trägt den "wartet auf"-Hook je Wert (Konzept §3).
const STATUS_LISTE_KEY = 'ticket_status';

// Farb-Palette als LITERALE Klassen — Tailwind generiert dynamische
// `bg-${slug}-500` nicht (kein Safelist), daher hier ausgeschrieben, damit
// jeder Farbpunkt sicher rendert.
const FARB_DOT: Record<string, string> = {
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  sky: 'bg-sky-500',
  orange: 'bg-orange-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  cyan: 'bg-cyan-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
};
const FARBEN = Object.keys(FARB_DOT);

function dotClass(farbe: string | null): string {
  return (farbe && FARB_DOT[farbe]) || 'bg-zinc-600';
}

/** Slugify ein Label zu einem stabilen Key (kebab/snake, ASCII). */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Sorge dafür, dass der Key innerhalb der Liste eindeutig ist. */
function uniqueKey(base: string, taken: Set<string>): string {
  const slug = base || 'wert';
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}_${i}`)) i += 1;
  return `${slug}_${i}`;
}

export function AuswahllistenPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateListe, setShowCreateListe] = useState(false);
  const [newListeKey, setNewListeKey] = useState('');
  const [newListeLabel, setNewListeLabel] = useState('');
  const [deleteListeConfirm, setDeleteListeConfirm] = useState<AuswahllisteRead | null>(
    null,
  );

  const qc = useQueryClient();
  const listenQuery = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
  });

  const createListe = useMutation({
    mutationFn: () => auswahllistenApi.create({ key: newListeKey, label: newListeLabel }),
    onSuccess: (liste) => {
      qc.invalidateQueries({ queryKey: ['auswahllisten'] });
      setSelectedId(liste.id);
      setShowCreateListe(false);
      setNewListeKey('');
      setNewListeLabel('');
    },
  });

  const deleteListe = useMutation({
    mutationFn: (id: string) => auswahllistenApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auswahllisten'] });
      setSelectedId(null);
    },
  });

  const selected = listenQuery.data?.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Auswahllisten</h1>
          <p className="text-sm text-zinc-500">
            Konfigurierbare Status-, Prioritäts- und Kategorie-Werte je Mandant
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateListe(true)}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Neue Liste
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <aside className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Listen
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {listenQuery.data?.map((liste) => (
              <li
                key={liste.id}
                onClick={() => setSelectedId(liste.id)}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-zinc-900/50 ${selectedId === liste.id ? 'bg-emerald-500/10 font-medium text-emerald-300' : 'text-zinc-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span>{liste.label}</span>
                  {liste.ist_system && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                      System
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {liste.key} · {liste.werte.length} Werte
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 md:col-span-2">
          {selected ? (
            <ListeDetail
              liste={selected}
              onDelete={() => setDeleteListeConfirm(selected)}
            />
          ) : (
            <div className="p-8 text-center text-sm text-zinc-500">
              Liste links auswählen, um Werte zu bearbeiten.
            </div>
          )}
        </section>
      </div>

      {showCreateListe && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={() => setShowCreateListe(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-zinc-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Neue Auswahlliste</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Anzeige-Label
                </label>
                <input
                  type="text"
                  value={newListeLabel}
                  onChange={(e) => {
                    const label = e.target.value;
                    setNewListeLabel(label);
                    // Key automatisch aus dem Label ableiten (Auto-ID).
                    setNewListeKey(slugify(label));
                  }}
                  placeholder="z.B. Gewerk"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  ID (Key, automatisch — bei Bedarf anpassbar)
                </label>
                <input
                  type="text"
                  value={newListeKey}
                  onChange={(e) => setNewListeKey(slugify(e.target.value))}
                  placeholder="z.B. gewerk"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateListe(false)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => createListe.mutate()}
                disabled={!newListeKey || !newListeLabel || createListe.isPending}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteListeConfirm !== null}
        title="Liste löschen?"
        message={
          deleteListeConfirm
            ? `Liste „${deleteListeConfirm.label}" wirklich löschen? Alle Werte werden ebenfalls entfernt.`
            : ''
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={deleteListe.isPending}
        onConfirm={() => {
          if (deleteListeConfirm) {
            deleteListe.mutate(deleteListeConfirm.id, {
              onSuccess: () => setDeleteListeConfirm(null),
            });
          }
        }}
        onCancel={() => setDeleteListeConfirm(null)}
      />
    </div>
  );
}

interface DetailProps {
  liste: AuswahllisteRead;
  onDelete: () => void;
}

function ListeDetail({ liste, onDelete }: DetailProps) {
  const qc = useQueryClient();
  const isStatusListe = liste.key === STATUS_LISTE_KEY;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['auswahllisten'] });

  // --- Listen-Label umbenennen (auch System-Listen, Key bleibt fix) ---
  const [listeLabel, setListeLabel] = useState(liste.label);
  useEffect(() => setListeLabel(liste.label), [liste.label]);
  const renameListe = useMutation({
    mutationFn: (label: string) => auswahllistenApi.update(liste.id, { label }),
    onSuccess: invalidate,
  });
  function commitListeLabel() {
    const next = listeLabel.trim();
    if (next && next !== liste.label) renameListe.mutate(next);
    else setListeLabel(liste.label);
  }

  // --- Neuen Wert hinzufügen (Auto-ID) ---
  const [newLabel, setNewLabel] = useState('');
  const [newFarbe, setNewFarbe] = useState<string>('slate');
  const [keyOverride, setKeyOverride] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [deleteWertConfirm, setDeleteWertConfirm] =
    useState<AuswahllistenWertRead | null>(null);

  const existingKeys = new Set(liste.werte.map((w) => w.key));
  const autoKey = newLabel.trim() ? uniqueKey(slugify(newLabel), existingKeys) : '';
  const effectiveKey = keyOverride != null ? slugify(keyOverride) : autoKey;

  const addWert = useMutation({
    mutationFn: (payload: AuswahllistenWertCreate) =>
      auswahllistenApi.addWert(liste.id, payload),
    onSuccess: () => {
      invalidate();
      setNewLabel('');
      setNewFarbe('slate');
      setKeyOverride(null);
      setShowKey(false);
    },
  });

  function submitAdd() {
    const label = newLabel.trim();
    if (!label) return;
    const key = uniqueKey(effectiveKey || slugify(label), existingKeys);
    const maxOrder = liste.werte.reduce((m, w) => Math.max(m, w.reihenfolge), -1);
    addWert.mutate({ key, label, farbe: newFarbe, reihenfolge: maxOrder + 1 });
  }

  const removeWert = useMutation({
    mutationFn: (wertId: string) => auswahllistenApi.removeWert(wertId),
    onSuccess: invalidate,
  });

  // --- Reihenfolge (echter Tausch der reihenfolge-Werte zweier Nachbarn) ---
  const sorted = [...liste.werte].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const reorder = useMutation({
    mutationFn: (p: { aId: string; aOrder: number; bId: string; bOrder: number }) =>
      Promise.all([
        auswahllistenApi.updateWert(p.aId, { reihenfolge: p.aOrder }),
        auswahllistenApi.updateWert(p.bId, { reihenfolge: p.bOrder }),
      ]),
    onSuccess: invalidate,
  });
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[j];
    if (!a || !b) return;
    reorder.mutate({
      aId: a.id,
      aOrder: b.reihenfolge,
      bId: b.id,
      bOrder: a.reihenfolge,
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <input
            value={listeLabel}
            onChange={(e) => setListeLabel(e.target.value)}
            onBlur={commitListeLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold text-zinc-100 hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-950 focus:outline-none"
          />
          <p className="px-1 text-xs text-zinc-500">
            Key: <span className="font-mono">{liste.key}</span>
            {liste.beschreibung ? ` · ${liste.beschreibung}` : ''}
            {liste.ist_system && ' · System-Liste'}
          </p>
        </div>
        {!liste.ist_system && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 text-xs text-red-400 hover:underline"
          >
            Liste löschen
          </button>
        )}
      </div>

      {isStatusListe && (
        <p className="border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-2 text-[11px] text-zinc-500">
          „Wartet-Grund“: Häkchen aktiviert pro Status den Sub-Grund-Picker im Ticket. Die
          Übergangsmatrix pflegst du weiter unter{' '}
          <span className="text-zinc-400">Stammdaten → Status-Workflow</span>.
        </p>
      )}

      <ul className="divide-y divide-zinc-800/60">
        {sorted.map((w, index) => (
          <WertRow
            key={w.id}
            wert={w}
            index={index}
            count={sorted.length}
            isStatusListe={isStatusListe}
            onMove={move}
            onDelete={() => setDeleteWertConfirm(w)}
          />
        ))}
        {sorted.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">
            Noch keine Werte — unten den ersten anlegen.
          </li>
        )}
      </ul>

      <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Neuen Wert hinzufügen
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={clsx('h-3 w-3 shrink-0 rounded-full', dotClass(newFarbe))} />
          <input
            type="text"
            value={newLabel}
            placeholder="Anzeige-Label"
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAdd();
            }}
            className="min-w-[10rem] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
          />
          <select
            value={newFarbe}
            onChange={(e) => setNewFarbe(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
          >
            {FARBEN.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitAdd}
            disabled={!newLabel.trim() || addWert.isPending}
            className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 text-sm text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            <Plus className="h-3.5 w-3.5" /> Hinzufügen
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span>ID:</span>
          {showKey ? (
            <input
              type="text"
              value={keyOverride ?? autoKey}
              onChange={(e) => setKeyOverride(e.target.value)}
              placeholder="key"
              className="w-40 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-zinc-200"
            />
          ) : (
            <span className="font-mono text-zinc-400">{effectiveKey || '—'}</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (showKey) {
                setShowKey(false);
                setKeyOverride(null);
              } else {
                setShowKey(true);
                setKeyOverride(autoKey);
              }
            }}
            className="text-emerald-400 hover:underline"
          >
            {showKey ? 'automatisch' : 'ID bearbeiten'}
          </button>
          {!showKey && <span className="text-zinc-600">wird aus dem Label erzeugt</span>}
        </div>
      </div>

      <ConfirmDialog
        open={deleteWertConfirm !== null}
        title="Wert löschen?"
        message={
          deleteWertConfirm ? `Wert „${deleteWertConfirm.label}" wirklich löschen?` : ''
        }
        tone="danger"
        confirmLabel="Löschen"
        busy={removeWert.isPending}
        onConfirm={() => {
          if (deleteWertConfirm) {
            removeWert.mutate(deleteWertConfirm.id, {
              onSuccess: () => setDeleteWertConfirm(null),
            });
          }
        }}
        onCancel={() => setDeleteWertConfirm(null)}
      />
    </div>
  );
}

interface WertRowProps {
  wert: AuswahllistenWertRead;
  index: number;
  count: number;
  isStatusListe: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onDelete: () => void;
}

function WertRow({ wert, index, count, isStatusListe, onMove, onDelete }: WertRowProps) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(wert.label);
  useEffect(() => setLabel(wert.label), [wert.label]);

  const erfordertGrund = Boolean(wert.meta?.['erfordert_grund']);

  const patch = useMutation({
    mutationFn: (payload: AuswahllistenWertUpdate) =>
      auswahllistenApi.updateWert(wert.id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auswahllisten'] }),
  });

  function commitLabel() {
    const next = label.trim();
    if (next && next !== wert.label) patch.mutate({ label: next });
    else setLabel(wert.label);
  }

  return (
    <li
      className={clsx(
        'flex items-center gap-2 px-3 py-2 text-sm',
        !wert.ist_aktiv && 'opacity-50',
      )}
    >
      <div className="flex flex-col text-zinc-500">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          className="hover:text-emerald-300 disabled:opacity-20"
          aria-label="Nach oben"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === count - 1}
          className="hover:text-emerald-300 disabled:opacity-20"
          aria-label="Nach unten"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <span className={clsx('h-3 w-3 shrink-0 rounded-full', dotClass(wert.farbe))} />
      <select
        value={wert.farbe ?? ''}
        onChange={(e) => patch.mutate({ farbe: e.target.value || null })}
        className="w-24 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-300"
        aria-label="Farbe"
      >
        <option value="">—</option>
        {FARBEN.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-medium text-zinc-200 hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-950 focus:outline-none"
      />

      <span className="hidden font-mono text-[11px] text-zinc-600 sm:inline">
        {wert.key}
      </span>

      {isStatusListe && (
        <label
          className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400"
          title="Verlangt einen Wartet-Grund, wenn ein Ticket diesen Status bekommt"
        >
          <input
            type="checkbox"
            checked={erfordertGrund}
            onChange={(e) =>
              patch.mutate({
                meta: { ...(wert.meta ?? {}), erfordert_grund: e.target.checked },
              })
            }
            className="h-3.5 w-3.5 accent-emerald-500"
          />
          Wartet-Grund
        </label>
      )}

      <button
        type="button"
        onClick={() => patch.mutate({ ist_aktiv: !wert.ist_aktiv })}
        className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title={wert.ist_aktiv ? 'Deaktivieren (aus Dropdowns ausblenden)' : 'Aktivieren'}
        aria-label={wert.ist_aktiv ? 'Deaktivieren' : 'Aktivieren'}
      >
        {wert.ist_aktiv ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>

      {wert.ist_system ? (
        <span
          className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500"
          title="System-Wert — nicht löschbar (nur deaktivierbar)"
        >
          System
        </span>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
          title="Wert löschen"
          aria-label="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
