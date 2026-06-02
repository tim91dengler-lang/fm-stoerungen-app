import { useEffect, useMemo, useRef, useState } from 'react';

import { DatePicker } from '../../components/DatePicker';
import { EntitySearchSelect, type SearchOption } from '../../components/EntitySearchSelect';

/**
 * Inline-Bearbeiten für Detail-Felder (Master-Layout-Standard, Tim-Entscheidung
 * 2026-06-02): Klick auf ein Feld → bearbeiten; Enter/Wegklicken speichert, Esc
 * bricht ab. Auto-Save pro Feld. Kein separates Formular.
 *
 * **Konsequent gestylte Controls** (kein natives <select>/<input type=date>):
 * - Freitext → `InlineEditText`
 * - Auswahlliste (Status/Typ) → `InlineEditSelect` (gestyltes Dropdown via `EntitySearchSelect`)
 * - Entität mit Server-Suche (Verantwortlich/User/Partner …) → `InlineEditEntity` (tippbar)
 * - Datum → `InlineEditDate` (gestylter Kalender via `DatePicker`)
 *
 * Standard-Baustein für ALLE Module — siehe Memory `detail-felder-keine-nativen-controls`.
 */
type CommitState = 'idle' | 'saving' | 'error';

const READ_CLS =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:border-emerald-600/60';
const EDIT_CLS =
  'w-full rounded-md border border-emerald-600 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500';

/** Lebenszyklus-Ref, um setState nach Unmount (Overlay/Tab schließt beim Speichern) zu vermeiden. */
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

/** Commit-Lifecycle für Picker-Felder (Select/Entity/Date): saving/error + Remount-Nonce,
 *  der bei Fehler die Anzeige auf den alten Wert zurücksetzt. */
function usePickerCommit(onCommit: (next: string | null) => Promise<void>, current: string | null) {
  const [state, setState] = useState<CommitState>('idle');
  const [nonce, setNonce] = useState(0);
  const mounted = useIsMounted();
  async function handle(next: string | null) {
    if (next === current) return;
    setState('saving');
    try {
      await onCommit(next);
      if (mounted.current) setState('idle');
    } catch {
      if (mounted.current) {
        setState('error');
        setNonce((n) => n + 1); // Picker remounten → Anzeige zurück auf alten Wert
      }
    }
  }
  return { state, nonce, handle };
}

/** Klickbarer Read-View (für Freitextfelder); öffnet den Editor. */
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

// --------------------------------------------------------------------------- Freitext

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
      close();
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

// --------------------------------------------------------------------------- Auswahlliste (Status/Typ)

export interface InlineSelectOption {
  value: string;
  label: string;
}

export function InlineEditSelect({
  label,
  value,
  options,
  queryKey,
  placeholder = 'Auswählen …',
  onCommit,
}: {
  label: string;
  /** Aktueller Schlüssel. */
  value: string;
  options: InlineSelectOption[];
  /** Eindeutiger Cache-Schlüssel (sonst Kollision bei gleichem Label). */
  queryKey: string;
  placeholder?: string;
  onCommit: (next: string) => Promise<void>;
}) {
  const { state, nonce, handle } = usePickerCommit((v) => onCommit(v ?? ''), value);
  const fetcher = useMemo(
    () => (q: string) =>
      Promise.resolve(
        options
          .filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
          .map<SearchOption>((o) => ({ id: o.value, label: o.label })),
      ),
    [options],
  );
  const currentLabel = options.find((o) => o.value === value)?.label ?? null;
  return (
    <FieldShell label={label} state={state}>
      <EntitySearchSelect
        key={nonce}
        value={value || null}
        initialLabel={currentLabel}
        fetcher={fetcher}
        queryKey={queryKey}
        allowClear={false}
        placeholder={placeholder}
        disabled={state === 'saving'}
        onChange={(id) => void handle(id)}
      />
    </FieldShell>
  );
}

// --------------------------------------------------------------------------- Entität mit Server-Suche

export function InlineEditEntity({
  label,
  value,
  displayLabel,
  fetcher,
  queryKey,
  allowClear = true,
  placeholder = 'Suchen …',
  onCommit,
}: {
  label: string;
  value: string | null;
  /** Label des aktuell gewählten Werts (für die Anzeige ohne Treffer-Load). */
  displayLabel: string | null;
  fetcher: (search: string) => Promise<SearchOption[]>;
  queryKey: string;
  allowClear?: boolean;
  placeholder?: string;
  onCommit: (next: string | null) => Promise<void>;
}) {
  const { state, nonce, handle } = usePickerCommit(onCommit, value);
  return (
    <FieldShell label={label} state={state}>
      <EntitySearchSelect
        key={nonce}
        value={value}
        initialLabel={displayLabel}
        fetcher={fetcher}
        queryKey={queryKey}
        allowClear={allowClear}
        placeholder={placeholder}
        disabled={state === 'saving'}
        onChange={(id) => void handle(id)}
      />
    </FieldShell>
  );
}

// --------------------------------------------------------------------------- Datum

export function InlineEditDate({
  label,
  value,
  onCommit,
}: {
  label: string;
  value?: string | null;
  onCommit: (next: string | null) => Promise<void>;
}) {
  const current = value ? value.slice(0, 10) : null;
  const { state, nonce, handle } = usePickerCommit(onCommit, current);
  return (
    <FieldShell label={label} state={state}>
      <DatePicker
        key={nonce}
        value={current}
        disabled={state === 'saving'}
        onChange={(iso) => void handle(iso)}
      />
    </FieldShell>
  );
}
