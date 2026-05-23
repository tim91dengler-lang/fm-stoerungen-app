import { test, type Page } from '@playwright/test';

/**
 * Regression-Test gegen den TanStack-Table-Grouping-Loop (gefixt in PR #33).
 *
 * Mit dem Bug hätte ein Klick auf den "Neu-…"-Button auf einer
 * PowerListenView-Seite den Mainthread für 4-10 Sekunden blockiert
 * (FROZEN nach 4s Playwright-Timeout). Wenn dieser Test rot wird,
 * ist der Loop zurück.
 *
 * Läuft per default gegen Staging — überschreibbar via BASE_URL env.
 */

const BASE = process.env.BASE_URL ?? 'http://178.105.172.110:8080';

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 15_000 });
}

const probes = [
  { path: '/stammdaten/adressen', click: 'Neue Adresse' },
  { path: '/stammdaten/objekte', click: 'Neues Objekt' },
  { path: '/stammdaten/partner', click: 'Neuer Partner' },
  { path: '/projekte', click: 'Neues Projekt' },
];

for (const p of probes) {
  test(`Power-Layout regression: ${p.path} click "${p.click}"`, async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}${p.path}`);
    await page.waitForTimeout(2000);
    const t = Date.now();
    let frozen = false;
    try {
      await page
        .getByRole('button', { name: new RegExp(p.click, 'i') })
        .first()
        .click({ timeout: 3500 });
    } catch {
      frozen = true;
    }
    const dt = Date.now() - t;
    console.log(`[REGRESSION] ${p.path} → ${frozen ? 'FROZEN' : 'ok'} (${dt}ms)`);
    if (frozen) {
      throw new Error(
        `Power-Layout Freeze auf ${p.path}: Klick "${p.click}" timeout (${dt}ms). ` +
          `Vermutlich TanStack-Table-Loop zurück — siehe PR #33 / tanstack-grouping-loop.md`,
      );
    }
  });
}
