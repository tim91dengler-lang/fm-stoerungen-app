import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Bearbeiten-Modus für die Partner-Detail-Page (Spec §5.2).
 *
 * - Default: Read-only.
 * - `enterEdit()` baut einen Klon vom Server-Wert als `draft`.
 * - `update(patch)` mergt teilweise Änderungen in den Draft.
 * - `cancelEdit()` verwirft den Draft.
 * - `saveEdit(payload)` ruft `onSave` mit dem fertigen Draft auf;
 *   `onSave` ist async (Caller hängt seine Mutation rein) — der Buffer
 *   bleibt im Edit-Modus, falls `onSave` wirft.
 * - `isDirty` ist `true`, sobald der Draft vom Server-Wert abweicht
 *   (Vergleich per `JSON.stringify`, reicht für flache Strukturen).
 * - `useBlocker` warnt bei React-Router-Navigation, falls Änderungen
 *   ungespeichert sind. Außerdem `beforeunload` für Browser-Tab-Wechsel.
 */
export interface EditBuffer<T> {
  editMode: boolean;
  draft: T | null;
  isDirty: boolean;
  enterEdit: () => void;
  cancelEdit: () => void;
  update: (patch: Partial<T>) => void;
  setDraft: (next: T) => void;
  /** Schließt den Edit-Modus, ohne zu speichern (nach erfolgreichem Save). */
  finishEdit: () => void;
  /** Wird `true`, sobald `useBlocker` einen Navigationsversuch fängt. */
  blocker: ReturnType<typeof useBlocker>;
}

export function useEditBuffer<T extends object>(source: T | null | undefined): EditBuffer<T> {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraftState] = useState<T | null>(null);

  const isDirty = useMemo(() => {
    if (!editMode || !draft || !source) return false;
    return JSON.stringify(draft) !== JSON.stringify(source);
  }, [editMode, draft, source]);

  const enterEdit = useCallback(() => {
    if (source) {
      setDraftState(structuredClone(source));
      setEditMode(true);
    }
  }, [source]);

  const cancelEdit = useCallback(() => {
    setDraftState(null);
    setEditMode(false);
  }, []);

  const finishEdit = useCallback(() => {
    setDraftState(null);
    setEditMode(false);
  }, []);

  const update = useCallback((patch: Partial<T>) => {
    setDraftState((cur) => (cur ? { ...cur, ...patch } : cur));
  }, []);

  const setDraft = useCallback((next: T) => {
    setDraftState(next);
  }, []);

  // Router-Navigation blockieren, solange dirty.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  // Browser-Tab schließen / Reload warnen.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return {
    editMode,
    draft,
    isDirty,
    enterEdit,
    cancelEdit,
    finishEdit,
    update,
    setDraft,
    blocker,
  };
}
