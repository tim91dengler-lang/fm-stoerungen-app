import { test, expect, type Page } from '@playwright/test';

/**
 * Regression-Tests für listen-polish-4 (Tim-Feldtest am Ticket-Pool):
 *
 *  L1 — Bedienspalten (__select__/__actions__) bleiben beim 2-Ebenen-Gruppieren
 *       ganz links. Mit dem Bug zog TanStacks groupedColumnMode 'reorder' die
 *       Gruppen-Spalten (Objekt, Priorität) DAVOR. Fix: columnPinning left.
 *
 *  L2 — Sticky-Header: beim Scrollen der (jetzt höhenbegrenzten) Tabelle bleibt
 *       die Spalten-Kopfzeile sichtbar. Mit dem Bug machte der overflow-x-auto-
 *       Wrapper position:sticky wirkungslos (Wrapper scrollte nie selbst).
 *
 * Läuft gegen den lokalen Dev-Server (override via E2E_BASE_URL).
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 15_000 });
}

test('L1: Bedienspalten bleiben bei 2-Ebenen-Gruppierung ganz links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector('table thead', { timeout: 15_000 });
  await page.waitForTimeout(1000);

  // Ansicht-Menü → Tab "Gruppen" → erst nach Objekt, dann nach Priorität
  await page
    .locator('button[title="Ansicht anpassen — Spalten · Gruppen · Density"]')
    .click();
  await page.getByRole('button', { name: 'Gruppen' }).click();
  await page.getByRole('button', { name: 'nach Objekt' }).click();
  await page.getByRole('button', { name: 'nach Priorität' }).click();
  // Menü schließen (Klick auf Überschrift)
  await page.getByRole('heading', { name: 'Ticket-Pool' }).click();
  await page.waitForTimeout(400);

  // Die ERSTE Zelle der Spalten-Kopfzeile muss die "Alle auswählen"-Checkbox
  // tragen — NICHT die Spalte "Objekt"/"Priorität".
  const firstHeaderCell = page
    .locator('table thead tr')
    .first()
    .locator('th')
    .first();
  await expect(firstHeaderCell.getByLabel('Alle auswählen')).toBeVisible();

  await page.screenshot({
    path: 'test-results/lp4-L1-grouped.png',
    fullPage: false,
  });
});

test('L2: Spalten-Kopfzeile bleibt beim Scrollen sichtbar (sticky)', async ({
  page,
}) => {
  // Kurzes Viewport erzwingt vertikalen Overflow im Tabellen-Container,
  // auch bei wenigen Zeilen.
  await page.setViewportSize({ width: 1280, height: 480 });
  await login(page);
  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector('table thead', { timeout: 15_000 });
  await page.waitForSelector('table tbody tr', { timeout: 15_000 });
  await page.waitForTimeout(800);

  // Scroll-Container = direkter Eltern-<div> der <table> (overflow-auto + maxHeight)
  const scrollBox = page.locator('table').locator('xpath=..');
  const scrolled = await scrollBox.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
  });
  // Sicherstellen, dass tatsächlich gescrollt wurde (sonst testet der Test nichts)
  expect(scrolled.scrollTop).toBeGreaterThan(0);
  await page.waitForTimeout(300);

  // Header muss nach dem Scrollen weiterhin im Viewport sein.
  await expect(page.getByLabel('Alle auswählen')).toBeInViewport();

  await page.screenshot({
    path: 'test-results/lp4-L2-scrolled.png',
    fullPage: false,
  });
});
