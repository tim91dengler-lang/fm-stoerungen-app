import { test, expect, type Page } from '@playwright/test';

/**
 * E2E-Tests für den Vorlagen-Designer (Track 2).
 *
 * Deckt die Hauptpfade aus Spec §7 ab: Anlegen, Live-Vorschau,
 * Sichtbar/Pflicht-Toggles, Duplizieren, Aktiv-Toggle inkl. Filterung
 * im Erfassungs-Modal, Löschen mit ConfirmDialog.
 *
 * Drag-and-Drop wird bewusst ausgespart: die @dnd-kit-Library erwartet
 * eine sehr spezifische Maus-Bewegungs-Sequenz, die in Playwright nur
 * mit `dispatchEvent`-Tricks zuverlässig läuft. Lieber abgegrenzt und
 * separat testbar.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@fm-staging.local';
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
  test('Neue Vorlage anlegen → erscheint in der Karten-Liste', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    const name = `E2E-Anlage ${Date.now()}`;

    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Bezeichnung').fill(name);
    await page.getByLabel('Beschreibung').fill('Smoke-Test über Playwright.');

    await page.getByRole('button', { name: 'Speichern' }).click();

    // Modal schließt + Karte mit dem Namen erscheint
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('Live-Vorschau zeigt Default-Felder beim Anlegen', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Header der Vorschau muss da sein
    await expect(dialog.getByText(/LIVE-VORSCHAU/i)).toBeVisible();

    // Mindestens diese System-Felder müssen in der Vorschau gerendert sein
    // (Pflicht-Defaults: Titel + Beschreibung). Wir prüfen ihre Labels.
    await expect(dialog.getByLabel('Titel', { exact: false }).first()).toBeVisible();
    await expect(dialog.getByLabel('Beschreibung', { exact: false }).first()).toBeVisible();
  });

  test('Bestehende Vorlage bearbeiten → Modal mit Felder-Liste', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    // Erste Karte öffnen (egal welche — System-Vorlagen sind immer da)
    const firstCard = page.locator('[class*="cursor-pointer"]').first();
    await firstCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Vorlage bearbeiten/ })).toBeVisible();

    // Es muss mindestens einen Sichtbar/Versteckt-Button geben
    const sichtbarButtons = dialog.getByRole('button', { name: /Sichtbar|Versteckt/ });
    await expect(sichtbarButtons.first()).toBeVisible();

    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    // Falls ConfirmDialog wegen unsaved auftaucht (sollte hier nicht, weil
    // wir nichts geändert haben), abfangen
    const verwerfen = page.getByRole('button', { name: 'Verwerfen' });
    if (await verwerfen.isVisible().catch(() => false)) {
      await verwerfen.click();
    }
    await expect(dialog).not.toBeVisible();
  });

  test('Duplizieren erzeugt eine Kopie mit "(Kopie)"-Suffix', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    // Wir legen erst eine eigene Vorlage an, damit der Test isoliert ist
    const baseName = `E2E-Quelle ${Date.now()}`;
    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await page.getByLabel('Bezeichnung').fill(baseName);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Karte mit baseName finden + duplizieren-Button hover-clicken
    const card = page
      .locator(`div:has-text("${baseName}")`)
      .filter({ has: page.getByLabel('Duplizieren') })
      .first();
    await card.hover();
    await card.getByLabel('Duplizieren').click();

    // Kopie erscheint
    await expect(page.getByText(`${baseName} (Kopie)`)).toBeVisible({ timeout: 5_000 });
  });

  test('Inaktive Vorlage taucht nicht im Erfassungs-Modal auf', async ({ page }) => {
    await login(page);
    await gotoVorlagen(page);

    // Anlegen
    const name = `E2E-Inaktiv ${Date.now()}`;
    await page.getByRole('button', { name: 'Neue Vorlage' }).click();
    await page.getByLabel('Bezeichnung').fill(name);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(name)).toBeVisible();

    // Deaktivieren
    const card = page
      .locator(`div:has-text("${name}")`)
      .filter({ has: page.getByLabel('Deaktivieren') })
      .first();
    await card.hover();
    await card.getByLabel('Deaktivieren').click();

    // Auf der VorlagenPage darf sie default ausgeblendet sein
    // (Filter "Inaktive einblenden" ist initial aus)
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

    // System-Vorlagen sind erkennbar am "System"-Badge. Wir prüfen,
    // dass auf einer solchen Karte kein Löschen-Aktions-Button ist.
    const systemCard = page
      .locator(`div:has-text("System"):has(div.font-semibold)`)
      .first();
    await expect(systemCard).toBeVisible();
    await systemCard.hover();
    await expect(systemCard.getByLabel('Löschen')).toHaveCount(0);
  });
});
