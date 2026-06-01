import { expect, test } from '@playwright/test';

/**
 * Stufe C — E2E des datengetriebenen Erfassen-Modals hinter Flag (C6).
 * Flag an → „Neues Ticket" → das Modal rendert die Felder block-gruppiert über die
 * Engine → Ticket anlegen. Erwartet den laufenden Dev-Stack mit Default-Vorlagen.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';

test('Flag-AN: Erfassen-Modal rendert Blöcke + Ticket anlegen', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ff_vorlage_layout_v2', '1'));

  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);

  await page.getByRole('button', { name: 'Neues Ticket' }).click();

  // Engine-Render im Modal: Block-Titel sichtbar (datengetrieben, single-column).
  await expect(page.getByText('Problem & Bearbeitung')).toBeVisible();
  await expect(page.getByText('Verortung')).toBeVisible();

  // Titel + Beschreibung (block-gruppiert, beide laut reparatur-Vorlage Pflicht) befüllen + anlegen.
  const titel = `E2E-C6 ${Date.now()}`;
  await page.getByLabel('Titel').fill(titel);
  await page.getByLabel('Beschreibung').fill('Angelegt durch Stufe-C-C6-E2E.');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  await expect(page.getByText(titel)).toBeVisible();
});
