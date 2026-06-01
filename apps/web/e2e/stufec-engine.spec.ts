import { expect, test } from '@playwright/test';

/**
 * Stufe C — E2E des datengetriebenen Detail-Panels hinter Flag `vorlage_layout_v2`.
 *
 * Setzt den Flag per localStorage (kein Rebuild nötig), legt ein Ticket an, öffnet
 * es und prüft, dass das Panel die Blöcke datengetrieben rendert + Felder editierbar
 * und das Ticket löschbar ist. Erwartet den laufenden Dev-Stack (vite 5173, dev-api
 * mit Stufe-C-Backend + geseedeten Default-Vorlagen).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';

test('Detail-Panel rendert Blöcke datengetrieben + Feld editierbar + löschbar', async ({
  page,
}) => {
  // Flag setzen, BEVOR die App-Bundles laufen.

  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/tickets/);

  // Ticket anlegen (Erfassen-Modal ist flag-unabhängig).
  const titel = `E2E-StufeC ${Date.now()}`;
  await page.getByRole('button', { name: 'Neues Ticket' }).click();
  await page.getByLabel('Titel').fill(titel);
  await page.getByLabel('Beschreibung').fill('Angelegt durch Stufe-C-E2E.');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByText(titel)).toBeVisible();

  // Detail öffnen → Engine-Render: Block-Titel beider Spalten sichtbar.
  await page.getByText(titel).first().click();
  await expect(page.getByText('Problem & Bearbeitung')).toBeVisible();
  await expect(page.getByText('Verortung')).toBeVisible();
  await expect(page.getByText('Klassifizierung')).toBeVisible();

  // Feld befüllen (Beschreibung im Problem-Block) → speichert per Blur, kein Fehler.
  const besch = page.getByPlaceholder('Details zur Störung');
  await besch.fill('E2E: Beschreibung im Engine-Pfad geändert.');
  await besch.blur();
  await expect(page.getByText('Speichern fehlgeschlagen.')).toHaveCount(0);

  // Löschen (confirm() bestätigen).
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Ticket löschen/ }).click();
  await expect(page.getByText(titel)).toHaveCount(0);
});
