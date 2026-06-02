import {
  adresseApi,
  anlageApi,
  fehlercodeApi,
  objektApi,
  partnerApi,
  projektApi,
  userApi,
} from '../api/endpoints';
import type { SearchOption } from '../components/EntitySearchSelect';

/**
 * Fetcher-Factories für `EntitySearchSelect`: jede übersetzt die List-API einer
 * Bewegungsdaten-Entität in normalisierte `SearchOption[]` (id + label + hint).
 * Alle nutzen die serverseitige `?search=`-Suche — kein Vorab-Load.
 */

const SEARCH_LIMIT = 20;

export function searchObjekte(search: string): Promise<SearchOption[]> {
  return objektApi
    .list({ search: search || undefined, limit: SEARCH_LIMIT })
    .then((r) => r.items.map((o) => ({ id: o.id, label: o.name })));
}

export function searchPartner(search: string): Promise<SearchOption[]> {
  return partnerApi
    .list({ search: search || undefined, limit: SEARCH_LIMIT })
    .then((r) => r.items.map((p) => ({ id: p.id, label: p.name })));
}

/** User-Suche (Verantwortlich, Zuweisung …) — serverseitig, skaliert bei vielen Usern. */
export function searchUsers(search: string): Promise<SearchOption[]> {
  return userApi
    .list({ search: search || undefined, limit: SEARCH_LIMIT })
    .then((r) => r.items.map((u) => ({ id: u.id, label: u.full_name })));
}

/** Adress-Suche (Objekt-Adresse …) — serverseitig. */
export function searchAdressen(search: string): Promise<SearchOption[]> {
  return adresseApi
    .list({ search: search || undefined, limit: SEARCH_LIMIT })
    .then((r) =>
      r.items.map((a) => ({ id: a.id, label: `${a.strasse}, ${a.plz} ${a.ort}` })),
    );
}

/** Projekt-Suche, optional auf bestimmte Status eingeschränkt (z. B. geplant/aktiv). */
export function makeProjektSearch(status?: string[]) {
  return (search: string): Promise<SearchOption[]> =>
    projektApi
      .list({ search: search || undefined, status, limit: SEARCH_LIMIT })
      .then((rows) =>
        rows
          .slice(0, SEARCH_LIMIT)
          .map((p) => ({ id: p.id, label: p.name, hint: p.status?.label ?? null })),
      );
}

/** Anlagen-Suche, optional auf ein Objekt eingeschränkt. */
export function makeAnlageSearch(objektId?: string | null) {
  return (search: string): Promise<SearchOption[]> =>
    anlageApi
      .list({
        search: search || undefined,
        aktiv_only: true,
        objekt_id: objektId ?? undefined,
        limit: SEARCH_LIMIT,
      })
      .then((rows) =>
        rows.slice(0, SEARCH_LIMIT).map((a) => ({
          id: a.id,
          label: a.bezeichnung,
          hint: a.kategorie?.label ?? null,
        })),
      );
}

/** Fehlercode-Suche, optional auf eine Anlage eingeschränkt. */
export function makeFehlercodeSearch(anlageId?: string | null) {
  return (search: string): Promise<SearchOption[]> =>
    fehlercodeApi
      .list({
        search: search || undefined,
        aktiv_only: true,
        anlage_id: anlageId ?? undefined,
        limit: SEARCH_LIMIT,
      })
      .then((rows) =>
        rows
          .slice(0, SEARCH_LIMIT)
          .map((fc) => ({ id: fc.id, label: `${fc.code} — ${fc.titel}` })),
      );
}

// --- loadLabel-Helfer für Preset-Werte (id bekannt, Label nachladen) ----------

export function loadObjektLabel(id: string): Promise<string | null> {
  return objektApi
    .get(id)
    .then((o) => o.name)
    .catch(() => null);
}

export function loadProjektLabel(id: string): Promise<string | null> {
  return projektApi
    .get(id)
    .then((p) => p.name)
    .catch(() => null);
}
