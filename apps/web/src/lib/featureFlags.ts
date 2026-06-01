/**
 * Feature-Flags (Stufe C).
 *
 * `vorlage_layout_v2` schaltet das datengetriebene Ticket-Rendering
 * (TicketFormEngine) und den Block-Designer (VorlageLayoutBuilder) frei.
 * **Default AUS** — der bisherige, fest verdrahtete Render-Pfad bleibt
 * unverändert, bis nach Staging-Acceptance umgelegt wird (Konzept §4.5).
 *
 * Aktivierung: Build mit `VITE_VORLAGE_LAYOUT_V2=1`. In Tests via
 * `__setVorlageLayoutV2(true)` erzwingbar.
 */
const truthy = (v: unknown): boolean => v === '1' || v === 'true' || v === true;

/** localStorage-Schlüssel zum Umschalten ohne Rebuild (E2E + Staging-Acceptance). */
export const VORLAGE_LAYOUT_V2_STORAGE_KEY = 'ff_vorlage_layout_v2';

let override: boolean | null = null;

function fromStorage(): boolean | null {
  try {
    const v = window.localStorage.getItem(VORLAGE_LAYOUT_V2_STORAGE_KEY);
    return v === null ? null : truthy(v);
  } catch {
    return null;
  }
}

export function isVorlageLayoutV2(): boolean {
  // Präzedenz: Test-Override → localStorage → Build-Env (Default AUS).
  if (override !== null) return override;
  const stored = fromStorage();
  if (stored !== null) return stored;
  return truthy(import.meta.env.VITE_VORLAGE_LAYOUT_V2);
}

/**
 * Übernimmt einen `?ff_vorlage_layout_v2=1|0`-URL-Parameter in localStorage,
 * damit das Flag per Link (statt DevTools-Konsole) umgeschaltet werden kann —
 * gedacht für die Staging-Acceptance durch nicht-technische Tester. Der Wert
 * wird persistiert und bleibt so über Navigation/Reload erhalten.
 *
 * Beim App-Start (`main.tsx`) genau einmal aufrufen.
 */
export function syncVorlageLayoutV2FromUrl(): void {
  try {
    const raw = new URLSearchParams(window.location.search).get(
      VORLAGE_LAYOUT_V2_STORAGE_KEY,
    );
    if (raw === null) return;
    window.localStorage.setItem(VORLAGE_LAYOUT_V2_STORAGE_KEY, truthy(raw) ? '1' : '0');
  } catch {
    // localStorage/URL nicht verfügbar (Privatmodus o. Ä.) — Flag bleibt auf Default.
  }
}

/** Nur für Tests: Flag erzwingen (`true`/`false`) oder auf Env zurücksetzen (`null`). */
export function __setVorlageLayoutV2(value: boolean | null): void {
  override = value;
}
