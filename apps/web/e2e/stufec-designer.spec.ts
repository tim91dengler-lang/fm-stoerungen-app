import { expect, request as pwRequest, test } from '@playwright/test';

/**
 * Stufe C — E2E des Block-Designers (VorlageLayoutBuilder) hinter Flag.
 * Öffnet eine Vorlage im Designer, prüft die Block-/Region-Struktur und speichert
 * das Layout über PUT /{id}/layout. Erwartet den laufenden Dev-Stack mit geseedeten
 * Default-Vorlagen.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';
const API = process.env.E2E_API ?? 'http://localhost:8000';

test('Designer-Builder rendert Blöcke + Layout speichern', async ({ page }) => {
  // Vorlage-ID direkt über die API holen (robuster als UI-Navigation).
  const api = await pwRequest.newContext();
  const login = await api.post(`${API}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = (await login.json()).access_token as string;
  const ttRes = await api.get(`${API}/api/v1/tickettypen`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const vorlagen = (await ttRes.json()) as { id: string; key: string }[];
  const vorlage = vorlagen.find((v) => v.key === 'reparatur') ?? vorlagen[0];
  await api.dispose();


  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);

  // Designer im Edit-Modus öffnen → Builder rendert.
  await page.goto(`/stammdaten/vorlagen/${vorlage.id}/bearbeiten`);
  await expect(page.getByText('Block-Layout')).toBeVisible();
  await expect(page.locator('[data-block-key="verortung"]')).toBeVisible();
  await expect(page.locator('[data-block-key="kopf"]')).toBeVisible();

  // Layout speichern → kein Fehler, Button kehrt zurück.
  await page.getByRole('button', { name: /Layout speichern/ }).click();
  await expect(page.getByText('Speichern fehlgeschlagen.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Layout speichern' })).toBeVisible();
});

async function dragHandleTo(
  page: import('@playwright/test').Page,
  handle: import('@playwright/test').Locator,
  target: import('@playwright/test').Locator,
) {
  const s = await handle.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('no bbox');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 8, s.y + s.height / 2 + 8); // Aktivierung
  await page.mouse.move(t.x + t.width / 2, t.y + 6, { steps: 10 });
  await page.mouse.move(t.x + t.width / 2, t.y + 4, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

test('Drag & Drop — Feld sortieren + Block in andere Region', async ({ page }) => {
  const api = await pwRequest.newContext();
  const login = await api.post(`${API}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = (await login.json()).access_token as string;
  const ttRes = await api.get(`${API}/api/v1/tickettypen`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const vorlagen = (await ttRes.json()) as { id: string; key: string }[];
  const vorlage = vorlagen.find((v) => v.key === 'reparatur') ?? vorlagen[0];
  await api.dispose();

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);
  await page.goto(`/stammdaten/vorlagen/${vorlage.id}/bearbeiten`);
  await expect(page.getByText('Block-Layout')).toBeVisible();

  const fieldOrder = () =>
    page
      .locator('[data-block-key="problem"] [data-feld-key]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-feld-key')));

  // Letztes Feld des Problem-Blocks an den Anfang ziehen.
  const before = await fieldOrder();
  await dragHandleTo(
    page,
    page.locator(
      `[data-feld-key="${before[before.length - 1]}"] button[aria-label*="ziehen"]`,
    ),
    page.locator(`[data-feld-key="${before[0]}"]`),
  );
  const after = await fieldOrder();
  expect(after).not.toEqual(before);
  expect(after[0]).toBe(before[before.length - 1]);

  // Block "verortung" von links nach rechts ziehen (über "belege").
  await dragHandleTo(
    page,
    page.locator('[data-block-key="verortung"] button[aria-label*="ziehen"]').first(),
    page.locator('[data-block-key="belege"]'),
  );
  await expect(
    page.locator('section:has-text("Region: Rechts") [data-block-key="verortung"]'),
  ).toHaveCount(1);
});
