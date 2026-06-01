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

test('Flag-AN: Designer-Builder rendert Blöcke + Layout speichern', async ({ page }) => {
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

  await page.addInitScript(() => localStorage.setItem('ff_vorlage_layout_v2', '1'));

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
