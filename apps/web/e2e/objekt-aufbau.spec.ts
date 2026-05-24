import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E-Test für Feature 3 (Objekt-Aufbau-UI).
 *
 * Strategie: alle API-Calls per page.route() mocken, damit der Test gegen den
 * lokalen vite dev-server (npm run dev) läuft, OHNE eine echte Backend-Instanz
 * zu brauchen. So decken wir den Modal-Flow + UI-Pflege deterministisch ab.
 *
 * Lokal starten:
 *   cd apps/web && npm run dev    # 1. Terminal
 *   cd apps/web && npx playwright test e2e/objekt-aufbau.spec.ts
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const OBJEKT_ID = '00000000-0000-0000-0000-000000000001';
const MIETER_PARTNER_ID = '00000000-0000-0000-0000-000000000aaa';

interface MockState {
  objekt: {
    id: string;
    mandant_id: string;
    name: string;
    adresse_id: string | null;
    adresse: null;
    notiz: null;
    partner_links: Array<{ partner_id: string; rolle: string; partner_name: string }>;
    created_at: string;
    updated_at: string;
  };
  tree: Array<{
    id: string;
    objekt_id: string;
    bezeichnung: string;
    notiz: string | null;
    reihenfolge: number;
    adresse: null;
    created_at: string;
    updated_at: string;
    stockwerke: Array<{
      id: string;
      haus_id: string;
      bezeichnung: string;
      ausrichtung: string | null;
      reihenfolge: number;
      has_grundriss: boolean;
      grundriss_mime: null;
      eigentuemer: null;
      mieter: [];
      created_at: string;
      updated_at: string;
      einheiten: Array<{
        id: string;
        stockwerk_id: string;
        bezeichnung: string;
        groesse_qm: number | null;
        reihenfolge: number;
        eigentuemer: null;
        mieter: Array<{ id: string; name: string }>;
        created_at: string;
        updated_at: string;
      }>;
    }>;
  }>;
  partner: Array<{
    id: string;
    mandant_id: string;
    name: string;
    ansprechpartner: null;
    email: null;
    telefon: null;
    adresse_id: null;
    adresse: null;
    notiz: null;
    typen: string[];
    created_at: string;
    updated_at: string;
  }>;
}

function makeState(): MockState {
  const now = new Date().toISOString();
  return {
    objekt: {
      id: OBJEKT_ID,
      mandant_id: '11111111-1111-1111-1111-111111111111',
      name: 'Demo-Objekt Talstraße 5',
      adresse_id: null,
      adresse: null,
      notiz: null,
      partner_links: [
        {
          partner_id: '00000000-0000-0000-0000-000000000bbb',
          rolle: 'eigentuemer',
          partner_name: 'Beispiel GmbH',
        },
      ],
      created_at: now,
      updated_at: now,
    },
    tree: [],
    partner: [
      {
        id: MIETER_PARTNER_ID,
        mandant_id: '11111111-1111-1111-1111-111111111111',
        name: 'Mieter Müller',
        ansprechpartner: null,
        email: null,
        telefon: null,
        adresse_id: null,
        adresse: null,
        notiz: null,
        typen: ['mieter'],
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000ccc',
        mandant_id: '11111111-1111-1111-1111-111111111111',
        name: 'Mieter Schmidt',
        ansprechpartner: null,
        email: null,
        telefon: null,
        adresse_id: null,
        adresse: null,
        notiz: null,
        typen: ['mieter'],
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000bbb',
        mandant_id: '11111111-1111-1111-1111-111111111111',
        name: 'Beispiel GmbH',
        ansprechpartner: null,
        email: null,
        telefon: null,
        adresse_id: null,
        adresse: null,
        notiz: null,
        typen: ['eigentuemer'],
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

let idCounter = 100;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(12, '0')}`;
}

async function setupApiMocks(page: Page, state: MockState): Promise<void> {
  // Seed auth state so ProtectedRoute lets us through without /login redirect
  await page.addInitScript(() => {
    window.localStorage.setItem('fm.access_token', 'mock-access-token');
    window.localStorage.setItem('fm.refresh_token', 'mock-refresh-token');
    window.localStorage.setItem(
      'fm.user',
      JSON.stringify({
        id: 'user-1',
        email: 'admin@example.com',
        mandant_id: '11111111-1111-1111-1111-111111111111',
        rolle: 'admin',
      }),
    );
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname.replace(/^\/api\/v1/, '');

    const ok = (body: unknown, status = 200): Promise<void> =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    // users/me
    if (path === '/users/me' && method === 'GET') {
      return ok({
        id: 'user-1',
        email: 'admin@example.com',
        mandant_id: state.objekt.mandant_id,
        rolle: 'admin',
      });
    }

    // notifications endpoints (NotificationsDropdown polls these)
    if (path === '/notifications' && method === 'GET') return ok([]);
    if (path === '/notifications/count' && method === 'GET') return ok({ unread: 0 });

    // objekt
    if (path === `/objekte/${OBJEKT_ID}` && method === 'GET') {
      return ok(state.objekt);
    }

    // tree
    if (path === `/objektstruktur/objekte/${OBJEKT_ID}/haus` && method === 'GET') {
      return ok(state.tree);
    }

    // partner list
    if (path === '/partner' && method === 'GET') {
      return ok({
        items: state.partner,
        total: state.partner.length,
        offset: 0,
        limit: 500,
      });
    }

    // Haus create
    if (path === `/objektstruktur/objekte/${OBJEKT_ID}/haus` && method === 'POST') {
      const body = req.postDataJSON() as { bezeichnung: string; notiz?: string | null };
      const now = new Date().toISOString();
      const haus = {
        id: nextId('haus'),
        objekt_id: OBJEKT_ID,
        bezeichnung: body.bezeichnung,
        notiz: body.notiz ?? null,
        reihenfolge: state.tree.length,
        adresse: null,
        created_at: now,
        updated_at: now,
        stockwerke: [],
      };
      state.tree.push(haus);
      return ok(haus, 201);
    }

    // Haus PATCH
    const mHausPatch = path.match(/^\/objektstruktur\/haus\/([^/]+)$/);
    if (mHausPatch && method === 'PATCH') {
      const hid = mHausPatch[1]!;
      const h = state.tree.find((x) => x.id === hid);
      if (!h) return route.fulfill({ status: 404, body: 'not found' });
      const body = req.postDataJSON() as { bezeichnung?: string; notiz?: string | null };
      if (body.bezeichnung !== undefined) h.bezeichnung = body.bezeichnung;
      if (body.notiz !== undefined) h.notiz = body.notiz;
      return ok(h);
    }

    // Haus DELETE
    if (mHausPatch && method === 'DELETE') {
      const hid = mHausPatch[1]!;
      const idx = state.tree.findIndex((x) => x.id === hid);
      if (idx >= 0) state.tree.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }

    // Stockwerk create
    const mStCreate = path.match(/^\/objektstruktur\/haus\/([^/]+)\/stockwerke$/);
    if (mStCreate && method === 'POST') {
      const hid = mStCreate[1]!;
      const h = state.tree.find((x) => x.id === hid);
      if (!h) return route.fulfill({ status: 404, body: 'not found' });
      const body = req.postDataJSON() as {
        bezeichnung: string;
        ausrichtung?: string | null;
      };
      const now = new Date().toISOString();
      const sw = {
        id: nextId('sw'),
        haus_id: hid,
        bezeichnung: body.bezeichnung,
        ausrichtung: body.ausrichtung ?? null,
        reihenfolge: h.stockwerke.length,
        has_grundriss: false,
        grundriss_mime: null,
        eigentuemer: null,
        mieter: [] as [],
        einheiten: [],
        created_at: now,
        updated_at: now,
      };
      h.stockwerke.push(sw);
      return ok(sw, 201);
    }

    // Stockwerk PATCH/DELETE
    const mSt = path.match(/^\/objektstruktur\/stockwerke\/([^/]+)$/);
    if (mSt && method === 'PATCH') {
      const sid = mSt[1]!;
      for (const h of state.tree) {
        const s = h.stockwerke.find((x) => x.id === sid);
        if (s) {
          const body = req.postDataJSON() as {
            bezeichnung?: string;
            ausrichtung?: string | null;
          };
          if (body.bezeichnung !== undefined) s.bezeichnung = body.bezeichnung;
          if (body.ausrichtung !== undefined) s.ausrichtung = body.ausrichtung;
          return ok(s);
        }
      }
      return route.fulfill({ status: 404, body: 'not found' });
    }
    if (mSt && method === 'DELETE') {
      const sid = mSt[1]!;
      for (const h of state.tree) {
        const idx = h.stockwerke.findIndex((x) => x.id === sid);
        if (idx >= 0) {
          h.stockwerke.splice(idx, 1);
          return route.fulfill({ status: 204, body: '' });
        }
      }
      return route.fulfill({ status: 404, body: 'not found' });
    }

    // Einheit create
    const mEinCreate = path.match(/^\/objektstruktur\/stockwerke\/([^/]+)\/einheiten$/);
    if (mEinCreate && method === 'POST') {
      const sid = mEinCreate[1]!;
      for (const h of state.tree) {
        const s = h.stockwerke.find((x) => x.id === sid);
        if (s) {
          const body = req.postDataJSON() as {
            bezeichnung: string;
            groesse_qm?: number | null;
            mieter_ids?: string[];
          };
          const now = new Date().toISOString();
          const mieter = (body.mieter_ids ?? []).map((mid) => {
            const p = state.partner.find((x) => x.id === mid);
            return { id: mid, name: p?.name ?? '???' };
          });
          const e = {
            id: nextId('e'),
            stockwerk_id: sid,
            bezeichnung: body.bezeichnung,
            groesse_qm: body.groesse_qm ?? null,
            reihenfolge: s.einheiten.length,
            eigentuemer: null,
            mieter,
            created_at: now,
            updated_at: now,
          };
          s.einheiten.push(e);
          return ok(e, 201);
        }
      }
      return route.fulfill({ status: 404, body: 'not found' });
    }

    // Einheit PATCH/DELETE
    const mEin = path.match(/^\/objektstruktur\/einheiten\/([^/]+)$/);
    if (mEin && method === 'PATCH') {
      const eid = mEin[1]!;
      for (const h of state.tree) {
        for (const s of h.stockwerke) {
          const e = s.einheiten.find((x) => x.id === eid);
          if (e) {
            const body = req.postDataJSON() as {
              bezeichnung?: string;
              groesse_qm?: number | null;
              mieter_ids?: string[];
            };
            if (body.bezeichnung !== undefined) e.bezeichnung = body.bezeichnung;
            if (body.groesse_qm !== undefined) e.groesse_qm = body.groesse_qm;
            if (body.mieter_ids !== undefined) {
              e.mieter = body.mieter_ids.map((mid) => {
                const p = state.partner.find((x) => x.id === mid);
                return { id: mid, name: p?.name ?? '???' };
              });
            }
            return ok(e);
          }
        }
      }
      return route.fulfill({ status: 404, body: 'not found' });
    }
    if (mEin && method === 'DELETE') {
      const eid = mEin[1]!;
      for (const h of state.tree) {
        for (const s of h.stockwerke) {
          const idx = s.einheiten.findIndex((x) => x.id === eid);
          if (idx >= 0) {
            s.einheiten.splice(idx, 1);
            return route.fulfill({ status: 204, body: '' });
          }
        }
      }
      return route.fulfill({ status: 404, body: 'not found' });
    }

    // Fallback for everything else (e.g. mandant info etc.)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

test('Objekt-Aufbau-UI: keine browser-prompt/confirm + voller Lifecycle', async ({
  page,
}) => {
  const state = makeState();
  await setupApiMocks(page, state);

  const browserDialogs: string[] = [];
  // If the app ever opened a browser-native prompt() or confirm(), Playwright
  // would block here. We assert at the end that none of these fired.
  page.on('dialog', (d) => {
    browserDialogs.push(`${d.type()}:${d.message()}`);
    void d.dismiss();
  });

  await page.goto(`${BASE}/stammdaten/objekte/${OBJEKT_ID}`, {
    waitUntil: 'domcontentloaded',
  });

  // Header rendered with name + Eigentümer pill
  await expect(page.getByRole('heading', { name: /Demo-Objekt Talstraße 5/ })).toBeVisible();
  await expect(page.getByText('Eigentümer', { exact: false })).toBeVisible();
  await expect(page.getByText('Beispiel GmbH')).toBeVisible();

  // ---- 1) Haus anlegen via modal ------------------------------------------
  await page.getByRole('button', { name: /Neues Haus/i }).click();
  const dialog1 = page.getByRole('dialog');
  await expect(dialog1).toBeVisible();
  await expect(dialog1.getByRole('heading', { name: 'Neues Haus' })).toBeVisible();
  await dialog1.getByPlaceholder('z. B. Haus A').fill('Haus A');
  await dialog1.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Haus A', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('(0 Stockwerke)').first()).toBeVisible();

  // ---- 2) Haus bearbeiten ------------------------------------------------
  // Haus row needs hover to reveal edit icon
  await page.getByText('Haus A', { exact: false }).first().hover();
  await page.getByRole('button', { name: 'Haus bearbeiten' }).first().click();
  const dialog2 = page.getByRole('dialog');
  await expect(dialog2.getByRole('heading', { name: 'Haus bearbeiten' })).toBeVisible();
  const hausInput = dialog2.getByPlaceholder('z. B. Haus A');
  await expect(hausInput).toHaveValue('Haus A');
  await hausInput.fill('Haus A (Hinterhaus)');
  await dialog2.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Haus A (Hinterhaus)').first()).toBeVisible();

  // ---- 3) Stockwerk anlegen via modal -----------------------------------
  await page.getByText('Haus A (Hinterhaus)').first().hover();
  await page.getByRole('button', { name: 'Stockwerk hinzufügen' }).first().click();
  const dialog3 = page.getByRole('dialog');
  await expect(dialog3.getByRole('heading', { name: 'Neues Stockwerk' })).toBeVisible();
  await dialog3.getByPlaceholder(/z\. B\. EG/i).fill('1. OG');
  await dialog3.locator('select').selectOption('nord');
  await dialog3.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('1. OG', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Nord/).first()).toBeVisible();

  // ---- 4) Einheit anlegen via modal mit Mieter --------------------------
  // Stockwerk-Node aufklappen, damit Einheiten danach sichtbar werden
  await page.getByText('1. OG', { exact: false }).first().click();
  await page.getByText('1. OG', { exact: false }).first().hover();
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).first().click();
  const dialog4 = page.getByRole('dialog');
  await expect(dialog4.getByRole('heading', { name: 'Neue Einheit' })).toBeVisible();
  await dialog4.getByPlaceholder(/z\. B\. EG-01/i).fill('Wohnung 7');
  // Mieter Müller in der Liste anklicken (steht im Modal-Body)
  await dialog4.getByRole('button', { name: /Mieter Müller/ }).first().click();
  await dialog4.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Wohnung 7').first()).toBeVisible();
  // Mieter-Pill auf Einheit sichtbar
  await expect(page.getByText('Mieter Müller', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('(1 Einheit)').first()).toBeVisible();

  // ---- 5) Einheit bearbeiten — Mieter wechseln --------------------------
  await page.getByText('Wohnung 7').first().hover();
  await page.getByRole('button', { name: 'Einheit bearbeiten' }).first().click();
  const dialog5 = page.getByRole('dialog');
  await expect(dialog5.getByRole('heading', { name: 'Einheit bearbeiten' })).toBeVisible();
  // Mieter Schmidt zusätzlich auswählen
  await dialog5.getByRole('button', { name: /Mieter Schmidt/ }).first().click();
  await dialog5.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Mieter Schmidt', { exact: false }).first()).toBeVisible();

  // ---- 6) Einheit löschen via Confirm-Dialog (KEIN browser confirm) -----
  await page.getByText('Wohnung 7').first().hover();
  await page.getByRole('button', { name: 'Einheit löschen' }).first().click();
  const confirm6 = page.getByRole('dialog');
  await expect(confirm6.getByRole('heading', { name: 'Einheit löschen?' })).toBeVisible();
  await confirm6.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Wohnung 7')).toHaveCount(0);

  // ---- 7) Stockwerk löschen via Confirm ---------------------------------
  await page.getByText('1. OG', { exact: false }).first().hover();
  await page.getByRole('button', { name: 'Stockwerk löschen' }).first().click();
  const confirm7 = page.getByRole('dialog');
  await expect(confirm7.getByRole('heading', { name: 'Stockwerk löschen?' })).toBeVisible();
  await confirm7.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('1. OG')).toHaveCount(0);

  // ---- 8) Haus löschen via Confirm --------------------------------------
  await page.getByText('Haus A (Hinterhaus)').first().hover();
  await page.getByRole('button', { name: 'Haus löschen' }).first().click();
  const confirm8 = page.getByRole('dialog');
  await expect(confirm8.getByRole('heading', { name: 'Haus löschen?' })).toBeVisible();
  await confirm8.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Haus A (Hinterhaus)')).toHaveCount(0);

  // ---- assertion: no browser-native dialogs fired -----------------------
  expect(browserDialogs).toEqual([]);
});
