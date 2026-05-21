import { test, expect } from '@playwright/test';

/**
 * Smoke E2E for Slice 1.
 *
 * Assumes a seeded admin user exists. The seed is created by the dev
 * docker-compose stack via `infra/scripts/seed-dev.py`.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@fm-staging.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';

test('login -> create ticket -> see it in the list', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /FM-Störungen/i })).toBeVisible();

  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await expect(page).toHaveURL(/\/tickets/);
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();

  const titel = `E2E Ticket ${Date.now()}`;

  await page.getByRole('button', { name: 'Neues Ticket' }).click();
  await page.getByLabel('Titel').fill(titel);
  await page.getByLabel('Beschreibung').fill('Erstellt durch Playwright-E2E.');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  // Wait for modal to close and list to reload
  await expect(page.getByText(titel)).toBeVisible();
});

test('logout returns to login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login/);
});
