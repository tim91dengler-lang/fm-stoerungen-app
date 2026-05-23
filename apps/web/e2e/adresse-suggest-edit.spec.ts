import { test, expect, type Page } from '@playwright/test';

/** Reproduziert Tims Bug 2026-05-23: Adresse bearbeiten mit Photon-Suggest. */

async function login(page: Page): Promise<void> {
  await page.goto('http://178.105.172.110:8080/login');
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });
}

test('Adresse bearbeiten + Photon-Suggest klicken + Speichern', async ({ page }) => {
  const errs: string[] = [];
  const responses: Array<{ method: string; url: string; status: number }> = [];

  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console.error: ${m.text()}`);
  });
  page.on('response', (resp) => {
    const url = resp.url();
    const method = resp.request().method();
    if (/\/api\/v1\//.test(url) && ['PATCH', 'POST', 'DELETE'].includes(method)) {
      responses.push({ method, url: url.replace('http://178.105.172.110:8080', ''), status: resp.status() });
    }
  });

  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/adressen');
  await page.waitForTimeout(1500);

  // Erste Adresse zum Bearbeiten öffnen
  await page.evaluate(() => {
    const row = document.querySelector('tbody tr') as HTMLElement | null;
    const btn = row?.querySelector('button[title="Bearbeiten"]') as HTMLElement | null;
    btn?.click();
  });
  await expect(page.getByText('Adresse bearbeiten')).toBeVisible({ timeout: 5_000 });
  console.log('Modal opened');

  // In Photon-Combobox tippen via JS-Event-Dispatch (Playwright-fill hängt)
  await page.evaluate(() => {
    const input = document.querySelector('[role="dialog"] input') as HTMLInputElement | null;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, 'Heilbronner');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  });
  await page.waitForTimeout(2000);

  // Erste Suggestion klicken
  const clicked = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const opts = Array.from(
      dialog?.querySelectorAll('[role="option"], li, button') ?? [],
    ) as HTMLElement[];
    const candidate = opts.find(
      (o) =>
        (o.textContent ?? '').toLowerCase().includes('heilbronner') &&
        !o.closest('input'),
    );
    if (candidate) {
      candidate.click();
      return { clicked: true, text: (candidate.textContent ?? '').slice(0, 100) };
    }
    return { clicked: false, count: opts.length, optsText: opts.slice(0, 5).map(o => (o.textContent ?? '').slice(0, 50)) };
  });
  console.log('Suggest click:', JSON.stringify(clicked));
  await page.waitForTimeout(500);

  // Bemerkung-Textarea ändern (damit ein change passiert)
  await page.evaluate(() => {
    const ta = document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = `Edit-${Date.now()}`;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Save-Button klicken
  const saveState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    const btns = Array.from(dialog?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
    const save = btns.find((b) => /Speicher/i.test(b.textContent ?? ''));
    return {
      found: !!save,
      disabled: save?.disabled ?? null,
      text: save?.textContent ?? null,
    };
  });
  console.log('Save-Button-State VOR click:', JSON.stringify(saveState));

  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    const btns = Array.from(dialog?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
    const save = btns.find((b) => /Speicher/i.test(b.textContent ?? ''));
    save?.click();
  });
  await page.waitForTimeout(3000);

  console.log('Mutations:', JSON.stringify(responses, null, 2));
  console.log('Errors:', errs);

  // Modal sollte zu sein (success)
  const stillOpen = await page.locator('[role="dialog"]').count();
  console.log('Modal still open?', stillOpen);

  const patches = responses.filter((r) => r.method === 'PATCH' && r.url.includes('/adressen/'));
  expect(patches.length, 'PATCH /adressen/{id} muss feuern').toBeGreaterThan(0);
  for (const p of patches) expect(p.status).toBeLessThan(300);
  expect(errs).toEqual([]);
});
