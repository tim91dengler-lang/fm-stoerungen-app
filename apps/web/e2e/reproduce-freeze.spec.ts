import { test } from '@playwright/test';

test.setTimeout(60_000);

test('CPU-Profile sammeln', async ({ page }) => {
  await page.goto('http://178.105.172.110:8080/login');
  await page.getByLabel('E-Mail').fill('admin@example.com');
  await page.getByLabel('Passwort').fill('admin-dev-pass-12');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(dashboard|tickets)/, { timeout: 10_000 });

  await page.getByRole('link', { name: /^Adressen$/ }).click();
  await page.waitForTimeout(2000);

  const client = await page.context().newCDPSession(page);
  await client.send('Profiler.enable');
  await client.send('Profiler.start');

  void page
    .getByRole('button', { name: /Spalten/i })
    .click({ timeout: 3000 })
    .catch(() => undefined);

  await page.waitForTimeout(4000);

  const profile = await client.send('Profiler.stop');
  const nodes = profile.profile.nodes;
  const samples = profile.profile.samples ?? [];
  const counts = new Map<number, number>();
  for (const s of samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('--- TOP 30 hottest functions during freeze ---');
  console.log(`(Total samples: ${samples.length})`);
  for (const [nodeId, count] of sorted) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const cf = node.callFrame;
    const url = (cf.url || '<?>').slice(-60);
    console.log(
      `${count.toString().padStart(5)} | ${(cf.functionName || '<anon>').slice(0, 40).padEnd(42)} | ${url}:${cf.lineNumber}`,
    );
  }
});
