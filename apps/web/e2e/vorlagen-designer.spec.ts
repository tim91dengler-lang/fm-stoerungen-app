import { test, expect, type Page } from '@playwright/test';

/**
 * E2E-Tests für den Vorlagen-Designer (Track 2 inkl. Page-Refactor).
 *
 * Deckt die Hauptpfade aus Spec §7 ab: Anlegen, Live-Vorschau,
 * Sichtbar/Pflicht-Toggles, Duplizieren, Aktiv-Toggle inkl. Filterung
 * im Erfassungs-Modal, Löschen mit ConfirmDialog.
 *
 * Drag-and-Drop wird bewusst ausgespart: @dnd-kit erwartet eine sehr
 * spezifische Maus-Bewegungs-Sequenz, die in Playwright nur mit
 * dispatchEvent-Tricks zuverlässig läuft.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-dev-pass-12';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });
}

async function gotoVorlagen(page: Page): Promise<void> {
  await page.goto('/stammdaten/vorlagen');
  await expect(page.getByRole('heading', { name: /Vorlagen \/ Tickettypen/ })).toBeVisible();
}

test.describe('Vorlagen-Designer', () => {
  test('„Neue Vorlage" navigiert auf eigene Page und legt eine Vorlage an', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    const name = `E2E-Anlage ${Date.now()}`;

    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await page.waitForURL(/\/stammdaten\/vorlagen\/neu/);
    await expect(page.getByRole('heading', { name: /Neue Vorlage/ })).toBeVisible();

    await page.getByLabel('Bezeichnung').fill(name);
    await page.getByLabel('Beschreibung').fill('Smoke-Test über Playwright.');

    await page.getByRole('button', { name: 'Speichern' }).click();

    // Redirect auf /:id/bearbeiten
    await page.waitForURL(/\/stammdaten\/vorlagen\/[0-9a-f-]+\/bearbeiten/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();

    // Liste zeigt die neue Vorlage
    await gotoVorlagen(page);
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('Live-Vorschau zeigt Default-Felder beim Anlegen', async ({ page }) => {
    await login(page);
    await page.goto('/stammdaten/vorlagen/neu');

    // Header der Vorschau muss da sein
    await expect(page.getByText(/LIVE-VORSCHAU/i)).toBeVisible();

    // Default-Pflicht-Felder müssen sichtbar sein (mindestens Titel + Beschreibung).
    await expect(page.getByText('Titel', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Beschreibung', { exact: false }).first()).toBeVisible();
  });

  test('Bestehende Vorlage öffnet als Page mit Block-Designer (Stufe C)', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    // Klick auf erste Karte navigiert
    const firstCard = page.locator('[class*="cursor-pointer"]').first();
    await firstCard.click();

    await page.waitForURL(/\/stammdaten\/vorlagen\/[0-9a-f-]+\/bearbeiten/);
    await expect(page.getByRole('heading', { name: /Vorlage bearbeiten:/ })).toBeVisible();

    // Edit-Modus zeigt den datengetriebenen Block-Designer (Stufe C).
    await expect(page.getByText('Block-Layout')).toBeVisible();
    await expect(page.locator('[data-block-key="kopf"]')).toBeVisible();
  });

  test('Duplizieren erzeugt eine Kopie mit "(Kopie)"-Suffix', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    // Eigene Quell-Vorlage anlegen, damit der Test isoliert ist
    const baseName = `E2E-Quelle ${Date.now()}`;
    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await page.getByLabel('Bezeichnung').fill(baseName);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/stammdaten\/vorlagen\/[0-9a-f-]+\/bearbeiten/, { timeout: 10_000 });

    // Zurück zur Liste, dort duplizieren
    await gotoVorlagen(page);
    const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: baseName }).first();
    await card.hover();
    await card.getByLabel('Duplizieren').click();

    await expect(page.getByText(`${baseName} (Kopie)`)).toBeVisible({ timeout: 5_000 });
  });

  test('Inaktive Vorlage taucht nicht im Erfassungs-Modal auf', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    const name = `E2E-Inaktiv ${Date.now()}`;
    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await page.getByLabel('Bezeichnung').fill(name);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/stammdaten\/vorlagen\/[0-9a-f-]+\/bearbeiten/, { timeout: 10_000 });

    // Zurück zur Liste, deaktivieren
    await gotoVorlagen(page);
    const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: name }).first();
    await card.hover();
    await card.getByLabel('Deaktivieren').click();

    // Filter "Inaktive einblenden" ist initial aus → Vorlage verschwindet
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 3_000 });

    // Im Erfassungs-Modal darf die deaktivierte Vorlage nicht erscheinen
    await page.goto('/tickets');
    await page.getByRole('button', { name: 'Neues Ticket' }).click();
    const ticketDialog = page.getByRole('dialog');
    await expect(ticketDialog).toBeVisible();
    await expect(ticketDialog.getByText(name)).not.toBeVisible();
  });

  test('System-Vorlage hat keinen Lösch-Button', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    const systemCard = page
      .locator('[class*="cursor-pointer"]')
      .filter({ hasText: 'System' })
      .first();
    await expect(systemCard).toBeVisible();
    await systemCard.hover();
    await expect(systemCard.getByLabel('Löschen')).toHaveCount(0);
  });

  // Hinweis: Das frühere Inline-Toggle im Edit-Modus (LIVE-VORSCHAU/Verbergen) ist
  // mit Stufe C durch den Block-Designer abgelöst — Sichtbar/Pflicht-Toggles dort
  // sind in stufec-designer.spec.ts abgedeckt.
});
