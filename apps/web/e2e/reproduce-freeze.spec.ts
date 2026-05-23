import { test } from '@playwright/test';

test('Test: AuswahllistenPage (kein PowerListenView)', async ({ page }) => {
  await page.goto('http://178.105.172.110:8080/login');
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });

  await page.goto('http://178.105.172.110:8080/stammdaten/auswahllisten');
  await page.waitForTimeout(2000);

  // Irgendeinen Button in dieser Page suchen + klicken
  const all = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(
      (b) => (b.textContent ?? '').trim().slice(0, 40),
    );
  });
  console.log('Available buttons:', all.slice(0, 20));

  // Erstes "Auswahlliste anlegen" Button
  const t = Date.now();
  try {
    await page.locator('button:visible').first().click({ timeout: 4000 });
    console.log(`Click OK in ${Date.now() - t} ms`);
  } catch {
    console.log(`Click FROZEN nach ${Date.now() - t} ms`);
  }
});
