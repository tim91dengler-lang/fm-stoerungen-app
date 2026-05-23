import { test } from '@playwright/test';
const pages = [
  { path: '/stammdaten/adressen', click: 'Neue Adresse' },
  { path: '/stammdaten/objekte', click: 'Neues Objekt' },
  { path: '/stammdaten/partner', click: 'Neuer Partner' },
  { path: '/stammdaten/anlagen', click: 'Neue Anlage' },
  { path: '/stammdaten/fehlercodes', click: 'Neuer Fehlercode' },
  { path: '/projekte', click: 'Neues Projekt' },
];
for (const p of pages) {
  test(`Page ${p.path}: ${p.click}`, async ({ page }) => {
    await page.goto('http://178.105.172.110:8080/login');
    await page.getByLabel('E-Mail').fill('admin@example.com');
    await page.getByLabel('Passwort').fill('admin-dev-pass-12');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });
    await page.goto(`http://178.105.172.110:8080${p.path}`);
    await page.waitForTimeout(1500);
    const t = Date.now();
    let frozen = false;
    try {
      await page.getByRole('button', { name: new RegExp(p.click, 'i') }).click({ timeout: 4000 });
    } catch { frozen = true; }
    console.log(`${p.path} click "${p.click}" → ${frozen ? 'FROZEN' : 'ok'} (${Date.now()-t}ms)`);
  });
}
