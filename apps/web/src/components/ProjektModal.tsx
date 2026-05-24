import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, FolderKanban, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { auswahllistenApi, objektApi, userApi } from '../api/endpoints';
import type {
  AuswahllistenWertRead,
  ObjektRead,
  ProjektCreate,
  ProjektRead,
  ProjektUpdate,
  UserRead,
} from '../api/types';

interface ProjektModalProps {
  open: boolean;
  /** If set, modal opens in edit mode and pre-populates from this projekt. */
  initial?: ProjektRead | null;
  onClose: () => void;
  /** Caller receives a payload matching ProjektCreate (also valid as ProjektUpdate). */
  onSubmit: (values: ProjektCreate) => void;
  isPending?: boolean;
}

interface FormState {
  name: string;
  beschreibung: string;
  projekttyp_slug: string;
  status_slug: string;
  verantwortlich_user_id: string | null;
  start_am: string | null;
  ende_am: string | null;
  notizen: string;
  objekt_ids: string[];
}

const EMPTY: FormState = {
  name: '',
  beschreibung: '',
  projekttyp_slug: '',
  status_slug: '',
  verantwortlich_user_id: null,
  start_am: null,
  ende_am: null,
  notizen: '',
  objekt_ids: [],
};

function activeWerte(liste: { werte: AuswahllistenWertRead[] } | undefined) {
  if (!liste) return [];
  return [...liste.werte]
    .filter((w) => w.ist_aktiv)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

export function ProjektModal({
  open,
  initial,
  onClose,
  onSubmit,
  isPending = false,
}: ProjektModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [objektSearch, setObjektSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const { data: auswahllisten } = useQuery({
    queryKey: ['auswahllisten'],
    queryFn: () => auswahllistenApi.list(),
    staleTime: 60_000,
    enabled: open,
  });

  const projekttypListe = auswahllisten?.find((l) => l.key === 'projekttyp');
  const statusListe = auswahllisten?.find((l) => l.key === 'projektstatus');

  const objekteQuery = useQuery({
    queryKey: ['objekte-for-projekt'],
    queryFn: () => objektApi.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-projekt'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: open,
  });

  const allObjekte: ObjektRead[] = useMemo(
    () => objekteQuery.data?.items ?? [],
    [objekteQuery.data],
  );
  const allUsers: UserRead[] = useMemo(
    () => usersQuery.data?.items ?? [],
    [usersQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setObjektSearch('');
    setUserSearch('');
    if (initial) {
      setForm({
        name: initial.name,
        beschreibung: initial.beschreibung ?? '',
        projekttyp_slug: initial.projekttyp.key,
        status_slug: initial.status.key,
        verantwortlich_user_id: initial.verantwortlich?.id ?? null,
        start_am: initial.start_am,
        ende_am: initial.ende_am,
        notizen: initial.notizen ?? '',
        objekt_ids: initial.objekte.map((o) => o.id),
      });
    } else {
      // Defaults: first projekttyp + status "geplant" (or first available)
      const defaultTyp = activeWerte(projekttypListe)[0]?.key ?? '';
      const defaultStatus =
        activeWerte(statusListe).find((w) => w.key === 'geplant')?.key ??
        activeWerte(statusListe)[0]?.key ??
        '';
      setForm({
        ...EMPTY,
        projekttyp_slug: defaultTyp,
        status_slug: defaultStatus,
      });
    }
  }, [open, initial, projekttypListe, statusListe]);

  const projekttypOptions = activeWerte(projekttypListe);
  const statusOptions = activeWerte(statusListe);

  const filteredObjekte = useMemo(() => {
    const q = objektSearch.trim().toLowerCase();
    if (!q) return allObjekte;
    return allObjekte.filter((o) => o.name.toLowerCase().includes(q));
  }, [allObjekte, objektSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [allUsers, userSearch]);

  const selectedObjekte = useMemo(() => {
    const set = new Set(form.objekt_ids);
    return allObjekte.filter((o) => set.has(o.id));
  }, [allObjekte, form.objekt_ids]);

  const selectedUser = useMemo(() => {
    if (!form.verantwortlich_user_id) return null;
    return allUsers.find((u) => u.id === form.verantwortlich_user_id) ?? null;
  }, [allUsers, form.verantwortlich_user_id]);

  if (!open) return null;

  const isEdit = !!initial;

  function toggleObjekt(id: string) {
    setForm((f) => {
      const next = new Set(f.objekt_ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, objekt_ids: Array.from(next) };
    });
  }

  function selectUser(id: string | null) {
    setForm((f) => ({ ...f, verantwortlich_user_id: id }));
  }

  function handleSubmit() {
    const name = form.name.trim();
    if (!name) {
      setError('Name ist Pflicht.');
      return;
    }
    if (!form.projekttyp_slug) {
      setError('Projekttyp ist Pflicht.');
      return;
    }
    if (!form.status_slug) {
      setError('Status ist Pflicht.');
      return;
    }
    setError(null);
    const payload: ProjektCreate = {
      name,
      beschreibung: form.beschreibung.trim() || null,
      projekttyp_slug: form.projekttyp_slug,
      status_slug: form.status_slug,
      verantwortlich_user_id: form.verantwortlich_user_id,
      start_am: form.start_am,
      ende_am: form.ende_am,
      notizen: form.notizen.trim() || null,
      objekt_ids: form.objekt_ids,
    };
    onSubmit(payload);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="projekt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2
            id="projekt-modal-title"
            className="flex items-center gap-2 text-lg font-semibold text-zinc-100"
          >
            <FolderKanban className="h-5 w-5 text-emerald-400" />
            {isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
              placeholder="z. B. Sanierung Treppenhaus Haus A"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Beschreibung
            </label>
            <textarea
              rows={2}
              value={form.beschreibung}
              onChange={(e) =>
                setForm((f) => ({ ...f, beschreibung: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Projekttyp <span className="text-red-400">*</span>
              </label>
              <select
                value={form.projekttyp_slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, projekttyp_slug: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="" disabled>
                  — bitte wählen —
                </option>
                {projekttypOptions.map((w) => (
                  <option key={w.id} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
              {projekttypOptions.length === 0 && (
                <p className="mt-1 text-[10px] text-amber-400">
                  Keine Projekttypen in Auswahlliste — bitte unter
                  Stammdaten → Auswahllisten pflegen.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Status <span className="text-red-400">*</span>
              </label>
              <select
                value={form.status_slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status_slug: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="" disabled>
                  — bitte wählen —
                </option>
                {statusOptions.map((w) => (
                  <option key={w.id} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Start
              </label>
              <input
                type="date"
                value={form.start_am ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_am: e.target.value || null }))
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Ende
              </label>
              <input
                type="date"
                value={form.ende_am ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ende_am: e.target.value || null }))
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Verantwortlich (single-select with search) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Verantwortlich
            </label>
            {selectedUser ? (
              <div className="mt-1 flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                <span className="text-sm text-emerald-300">
                  {selectedUser.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => selectUser(null)}
                  className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20"
                  aria-label="Verantwortlichen entfernen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Verantwortlichen suchen …"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                {userSearch.trim() && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/30 p-1">
                    {filteredUsers.length === 0 ? (
                      <p className="px-2 py-2 text-center text-xs text-zinc-500">
                        Keine Treffer.
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {filteredUsers.slice(0, 20).map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => {
                                selectUser(u.id);
                                setUserSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                            >
                              <span>{u.full_name}</span>
                              <span className="text-[10px] text-zinc-500">
                                {u.email}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Objekte (multi-select with search, Mieter-Pattern) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Objekte ({selectedObjekte.length} ausgewählt)
            </label>
            {selectedObjekte.length > 0 && (
              <div className="mt-1 mb-2 flex flex-wrap gap-1">
                {selectedObjekte.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300"
                  >
                    <Building2 className="h-3 w-3" />
                    {o.name}
                    <button
                      type="button"
                      onClick={() => toggleObjekt(o.id)}
                      className="rounded-full p-0.5 hover:bg-emerald-500/20"
                      aria-label={`${o.name} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={objektSearch}
                onChange={(e) => setObjektSearch(e.target.value)}
                placeholder="Objekt suchen …"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/30 p-1">
              {allObjekte.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-zinc-500">
                  Keine Objekte angelegt.
                </p>
              ) : filteredObjekte.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-zinc-500">
                  Keine Treffer für „{objektSearch}&quot;.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredObjekte.map((o) => {
                    const active = form.objekt_ids.includes(o.id);
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => toggleObjekt(o.id)}
                          className={clsx(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                              : 'text-zinc-300 hover:bg-zinc-800',
                          )}
                        >
                          <span>{o.name}</span>
                          {active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Notizen
            </label>
            <textarea
              rows={3}
              value={form.notizen}
              onChange={(e) =>
                setForm((f) => ({ ...f, notizen: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {isPending ? 'Speichere …' : isEdit ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ProjektUpdate };
