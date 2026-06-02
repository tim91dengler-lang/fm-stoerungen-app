import { expect, request as pwRequest, test } from '@playwright/test';

/**
 * Master-Layout-Standard, Slice 1 (Referenz-Modul Projekt) hinter Flag
 * `modul_standard`. Liste → zentriertes Detail-Overlay → Verknüpfung öffnet
 * Ebene-3-Liste. Erwartet den laufenden Dev-Stack mit geseedeten Projekten.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';
const API = process.env.E2E_API ?? 'http://localhost:8000';

test('Flag-AN: Projekt-Detail als zentriertes Overlay + Verknüpfung öffnet Ebene-3-Liste', async ({
  page,
}) => {
  const api = await pwRequest.newContext();
  const login = await api.post(`${API}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = (await login.json()).access_token as string;
  const res = await api.get(`${API}/api/v1/projekte`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const projekte = (Array.isArray(body) ? body : body.items) as { name: string }[];
  const name = projekte[0]?.name;
  expect(name, 'mindestens ein Projekt geseedet').toBeTruthy();
  await api.dispose();

  await page.addInitScript(() => localStorage.setItem('ff_modul_standard', '1'));
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);

  await page.goto('/projekte');
  // Klick auf den Projektnamen öffnet das Overlay (kein Seitenwechsel).
  await page.getByRole('button', { name }).first().click();
  await expect(page).toHaveURL(/\/projekte$/); // keine Navigation auf /projekte/:id
  await expect(page.getByRole('button', { name: /schließen/i})).toBeVisible();
  await expect(page.locator('[data-block="stammdaten"]')).toBeVisible();

  // Verknüpfung → Ebene-3-Liste
  await page.getByText(/in Listenansicht öffnen/).first().click();
  await expect(page.getByText(/zurück zum Detail/)).toBeVisible();

  // zurück + schließen
  await page.getByText(/zurück zum Detail/).click();
  await page.getByRole('button', { name: /schließen/i}).click();
  await expect(page.getByRole('button', { name: /schließen/i})).toHaveCount(0);
});
