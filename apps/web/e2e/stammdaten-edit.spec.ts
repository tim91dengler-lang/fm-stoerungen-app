import { test, expect, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('http://178.105.172.110:8080/login');
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });
}

interface EditResult {
  errs: string[];
  responses: Array<{ url: string; status: number }>;
}

/**
 * Öffnet auf der aktuellen Seite die erste existierende Zeile per Pencil-Icon,
 * setzt das erste Textarea (oder Text-Input falls keins) im Modal auf einen
 * neuen Wert, klickt Speichern. Erfasst pageerrors + alle Mutation-Responses.
 */
async function editFirstRow(page: Page, modalTitleSnippet: string): Promise<EditResult> {
  const result: EditResult = { errs: [], responses: [] };
  page.on('pageerror', (e) => result.errs.push(e.message));
  page.on('response', (resp) => {
    const url = resp.url();
    if (
      /\/api\/v1\//.test(url) &&
      ['PATCH', 'POST', 'DELETE'].includes(resp.request().method())
    ) {
      result.responses.push({ url, status: resp.status() });
    }
  });

  // Pencil-Icon der ersten Zeile klicken
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr')) as HTMLElement[];
    const firstRow = rows[0];
    if (!firstRow) throw new Error('no rows found');
    const btn = firstRow.querySelector('button[title="Bearbeiten"]') as HTMLElement | null;
    if (!btn) throw new Error('no Bearbeiten button in first row');
    btn.click();
  });

  // Auf Modal warten
  await expect(page.getByText(modalTitleSnippet)).toBeVisible({ timeout: 5_000 });

  // Im Modal das erste Textarea (für Beschreibung/Notiz) oder Input nehmen,
  // einen Timestamp dranhängen
  const ts = Date.now();
  const modified = await page.evaluate((suffix) => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    if (!dialog) return { ok: false, reason: 'no dialog' };
    // erst Textarea probieren
    const ta = dialog.querySelector('textarea') as HTMLTextAreaElement | null;
    if (ta) {
      const newVal = `${(ta.value ?? '').slice(0, 100)} EDIT-${suffix}`.trim();
      ta.value = newVal;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, field: 'textarea', newVal };
    }
    // sonst zweites Text-Input (erstes ist meist Name/Pflicht, das wollen wir nicht ändern)
    const inputs = Array.from(
      dialog.querySelectorAll('input[type="text"], input[type="email"]'),
    ) as HTMLInputElement[];
    const target = inputs[1] ?? inputs[0];
    if (!target) return { ok: false, reason: 'no input' };
    const newVal = `${(target.value ?? '').slice(0, 50)} E-${suffix}`.trim();
    target.value = newVal;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, field: 'input', newVal };
  }, String(ts));

  console.log('modified:', JSON.stringify(modified));

  // Speichern
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    const btns = Array.from(dialog?.querySelectorAll('button') ?? []) as HTMLElement[];
    const save = btns.find((b) => (b.textContent ?? '').trim() === 'Speichern');
    save?.click();
  });

  await page.waitForTimeout(2500);
  return result;
}

test('Adresse: bestehende Adresse bearbeiten', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/adressen');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Adresse bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/adressen/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Anlage: bestehende Anlage bearbeiten', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/anlagen');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Anlage bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/anlagen/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Fehlercode: bestehenden Fehlercode bearbeiten', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/fehlercodes');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Fehlercode bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/fehlercodes/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Partner: bestehenden Partner bearbeiten (war der Tim-Crash)', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/partner');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Partner bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/partner/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Objekt: bestehendes Objekt bearbeiten', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/objekte');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Objekt bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/objekte/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Projekt: bestehendes Projekt bearbeiten', async ({ page }) => {
  await login(page);
  await page.goto('http://178.105.172.110:8080/projekte');
  await page.waitForTimeout(1500);
  const r = await editFirstRow(page, 'Projekt bearbeiten');
  console.log('Responses:', r.responses);
  console.log('Errors:', r.errs);
  expect(r.errs).toEqual([]);
  const patches = r.responses.filter((x) => x.url.includes('/projekte/'));
  expect(patches.length).toBeGreaterThan(0);
  for (const p of patches) expect(p.status, `PATCH ${p.url} should be 2xx`).toBeLessThan(300);
});

test('Vorlagen: Sichtbar-Toggle pro Feld speichert', async ({ page }) => {
  const errs: string[] = [];
  const responses: Array<{ url: string; status: number }> = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('response', (resp) => {
    const url = resp.url();
    if (/\/api\/v1\/tickettypen\//.test(url) && resp.request().method() === 'PATCH') {
      responses.push({ url, status: resp.status() });
    }
  });

  await login(page);
  await page.goto('http://178.105.172.110:8080/stammdaten/vorlagen');
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
    const tt = btns.find(
      (b) =>
        (b.textContent ?? '').includes('Reparatur') &&
        (b.textContent ?? '').includes('sichtbar'),
    );
    tt?.click();
  });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
    const target = btns.find((b) =>
      ['Sichtbar', 'Versteckt'].includes((b.textContent ?? '').trim()),
    );
    target?.click();
  });
  await page.waitForTimeout(2000);

  // Zurück toggeln
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
    const target = btns.find((b) =>
      ['Sichtbar', 'Versteckt'].includes((b.textContent ?? '').trim()),
    );
    target?.click();
  });
  await page.waitForTimeout(1500);

  console.log('Vorlagen Responses:', responses);
  expect(errs).toEqual([]);
  expect(responses.length).toBeGreaterThanOrEqual(2);
  for (const r of responses) expect(r.status).toBeLessThan(300);
});
