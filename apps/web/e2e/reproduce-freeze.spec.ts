import { test } from '@playwright/test';

test('Was friert wirklich? Schritt-für-Schritt', async ({ page }) => {
  await page.goto('http://178.105.172.110:8080/login');
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });

  console.log('--- Phase 1: Sidebar-Klick zu Adressen (außerhalb der Page) ---');
  let t = Date.now();
  try {
    await page.getByRole('link', { name: /^Adressen$/ }).click({ timeout: 4000 });
    console.log(`  Sidebar-Link OK in ${Date.now() - t} ms`);
  } catch {
    console.log(`  Sidebar-Link FROZEN nach ${Date.now() - t} ms`);
  }

  await page.waitForTimeout(1500);

  console.log('--- Phase 2: Sidebar-Klick zu Dashboard ---');
  t = Date.now();
  try {
    await page.getByRole('link', { name: 'Dashboard' }).click({ timeout: 4000 });
    console.log(`  Sidebar-Dashboard OK in ${Date.now() - t} ms`);
  } catch {
    console.log(`  Sidebar-Dashboard FROZEN nach ${Date.now() - t} ms`);
  }

  console.log('--- Phase 3: Bell-Icon im Header klicken ---');
  await page.waitForTimeout(1500);
  t = Date.now();
  try {
    await page.getByLabel('Benachrichtigungen').click({ timeout: 4000 });
    console.log(`  Bell OK in ${Date.now() - t} ms`);
  } catch {
    console.log(`  Bell FROZEN nach ${Date.now() - t} ms`);
  }

  console.log('--- Phase 4: NACH Bell-Klick, ein Sidebar-Link ---');
  await page.waitForTimeout(1500);
  t = Date.now();
  try {
    await page.getByRole('link', { name: /^Adressen$/ }).click({ timeout: 4000 });
    console.log(`  Sidebar OK in ${Date.now() - t} ms`);
  } catch {
    console.log(`  Sidebar FROZEN nach ${Date.now() - t} ms`);
  }
});
