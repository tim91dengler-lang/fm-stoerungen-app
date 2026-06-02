import { useEffect, useRef, useState } from 'react';

/**
 * Inline-Bearbeiten für Detail-Felder (Master-Layout-Standard, Tim-Entscheidung
 * 2026-06-02): Klick auf ein Feld → Editor; **Enter / Wegklicken speichert**,
 * **Esc bricht ab**. Kein separates Formular, kein „Speichern"-Knopf. Pro Feld
 * eine `onCommit`-Zusage (das Modul verdrahtet sie mit seiner PATCH-Mutation);
 * der Speicher-/Fehlerzustand wird dezent am Feld angezeigt.
 *
 * Bewusst klein gehalten und render-agnostisch — Standard-Baustein für ALLE
 * Module. Read-Ansicht ist ein fokussierbarer Button (Tastatur: Enter öffnet).
 */
type CommitState = 'idle' | 'saving' | 'error';

const READ_CLS =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:border-emerald-600/60';
const EDIT_CLS =
  'w-full rounded-md border border-emerald-600 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500';

/** Lebenszyklus-Ref, um setState nach dem Unmount (z. B. Overlay-Schließen während
 *  des Speicherns) zu vermeiden. */
function useIsMounted() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

function FieldShell({
  label,
  state,
  children,
}: {
  label: string;
  state: CommitState;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
        <span>{label}</span>
        {state === 'saving' && <span className="normal-case text-emerald-400">· speichert …</span>}
        {state === 'error' && (
          <span className="normal-case text-red-400">· Fehler — erneut versuchen</span>
        )}
      </div>
      {children}
    </div>
  );
}

function fmtDate(s?: string | null) {
  return s ? s.slice(0, 10).split('-').reverse().join('.') : null;
}

/** Klickbarer Read-View; öffnet den Editor. */
function ReadButton({
  label,
  onOpen,
  children,
}: {
  label: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label} bearbeiten`}
      title="Zum Bearbeiten klicken"
      className={READ_CLS}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

export function InlineEditText({
  label,
  value,
  multiline = false,
  required = false,
  placeholder,
  onCommit,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
  /** Pflichtfeld: leerer Draft wird verworfen (kein Commit/422-Roundtrip). */
  required?: boolean;
  placeholder?: string;
  onCommit: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [state, setState] = useState<CommitState>('idle');
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);
  const inFlightRef = useRef(false);
  const mounted = useIsMounted();

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function close() {
    setState('idle');
    setEditing(false);
  }

  async function commit() {
    if (inFlightRef.current) return; // verhindert Doppel-Commit (Enter + folgender Blur)
    if (required && draft.trim() === '') {
      setDraft(value ?? ''); // Pflichtfeld nicht leeren → still revertieren
      close();
      return;
    }
    if ((value ?? '') === draft) {
      close(); // unverändert: schließen + evtl. altes Fehler-Label aufräumen
      return;
    }
    inFlightRef.current = true;
    setState('saving');
    try {
      await onCommit(draft === '' ? null : draft);
      if (!mounted.current) return;
      close();
    } catch {
      if (mounted.current) setState('error');
    } finally {
      inFlightRef.current = false;
    }
  }
  function handleBlur() {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    void commit();
  }
  function cancel() {
    cancelRef.current = true;
    setDraft(value ?? '');
    close();
  }

  if (!editing) {
    return (
      <FieldShell label={label} state={state}>
        <ReadButton label={label} onOpen={() => setEditing(true)}>
          {value ? value : <span className="text-zinc-600">— leer —</span>}
        </ReadButton>
      </FieldShell>
    );
  }

  const common = {
    ref,
    value: draft,
    placeholder,
    disabled: state === 'saving',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: handleBlur,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        void commit();
      }
    },
  };

  return (
    <FieldShell label={label} state={state}>
      {multiline ? (
        <textarea {...common} className={`${EDIT_CLS} min-h-[4rem] resize-y leading-relaxed`} />
      ) : (
        <input {...common} className={EDIT_CLS} />
      )}
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------

export interface InlineSelectOption {
  value: string;
  label: string;
}

export function InlineEditSelect({
  label,
  value,
  display,
  options,
  onCommit,
}: {
  label: string;
  /** Aktueller Schlüssel (''=leer). */
  value: string;
  /** Read-Ansicht (z. B. ein Badge oder Text). */
  display: React.ReactNode;
  options: InlineSelectOption[];
  onCommit: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<CommitState>('idle');
  const ref = useRef<HTMLSelectElement>(null);
  const mounted = useIsMounted();

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  async function commit(next: string) {
    if (next === value) {
      setState('idle');
      setEditing(false);
      return;
    }
    setState('saving');
    try {
      await onCommit(next);
      if (!mounted.current) return;
      setState('idle');
      setEditing(false);
    } catch {
      if (mounted.current) setState('error'); // bleibt offen → erneute Auswahl möglich
    }
  }

  if (!editing) {
    return (
      <FieldShell label={label} state={state}>
        <ReadButton label={label} onOpen={() => setEditing(true)}>
          {display}
        </ReadButton>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={label} state={state}>
      <select
        ref={ref}
        defaultValue={value}
        disabled={state === 'saving'}
        className={EDIT_CLS}
        onChange={(e) => void commit(e.target.value)}
        onBlur={() => {
          if (state !== 'error') setEditing(false); // bei Fehler offen lassen (Retry)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setState('idle');
            setEditing(false);
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------

export function InlineEditDate({
  label,
  value,
  onCommit,
}: {
  label: string;
  value?: string | null;
  onCommit: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<CommitState>('idle');
  const ref = useRef<HTMLInputElement>(null);
  const mounted = useIsMounted();
  const iso = value ? value.slice(0, 10) : '';

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  async function commit(nextIso: string) {
    if (nextIso === iso) {
      setState('idle');
      setEditing(false);
      return;
    }
    setState('saving');
    try {
      await onCommit(nextIso || null);
      if (!mounted.current) return;
      setState('idle');
      setEditing(false);
    } catch {
      if (mounted.current) setState('error');
    }
  }

  if (!editing) {
    return (
      <FieldShell label={label} state={state}>
        <ReadButton label={label} onOpen={() => setEditing(true)}>
          {value ? fmtDate(value) : <span className="text-zinc-600">— leer —</span>}
        </ReadButton>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={label} state={state}>
      <input
        ref={ref}
        type="date"
        defaultValue={iso}
        disabled={state === 'saving'}
        className={EDIT_CLS}
        onChange={(e) => void commit(e.target.value)}
        onBlur={() => {
          if (state !== 'error') setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setState('idle');
            setEditing(false);
          }
        }}
      />
    </FieldShell>
  );
}
