import { expect, test, type Page } from '@playwright/test';

/**
 * Browser-mode tests: the panels run in plain Chromium with the FDC3 shim.
 * Pages opened in the same browser context share BroadcastChannel, exactly
 * like tabs in one browser profile.
 */

async function openPanel(page: Page, path: string, badgeText: RegExp) {
  await page.goto(path);
  await expect(page.locator('#api-badge')).toHaveText(badgeText, { timeout: 15_000 });
}

test('blotter broadcast reaches the monitor and filters the blotter', async ({ context }) => {
  const blotter = await context.newPage();
  const monitor = await context.newPage();
  await openPanel(blotter, '/blotter/', /FDC3 shim/);
  await openPanel(monitor, '/monitor/', /FDC3 shim/);

  await blotter.fill('#symbol', 'nvda');
  await blotter.press('#symbol', 'Enter');

  await expect(blotter.locator('#current')).toHaveText('NVDA');
  await expect(blotter.locator('#orders tbody tr')).not.toHaveCount(0);
  const symbols = await blotter.locator('#orders tbody tr td:nth-child(2)').allTextContents();
  expect(new Set(symbols)).toEqual(new Set(['NVDA']));

  await expect(monitor.locator('#count')).toHaveText('1');
  await expect(monitor.locator('#log .log-row').first()).toContainText('received fdc3.instrument');
  await expect(monitor.locator('#log .log-row').first()).toContainText('NVDA');
});

test('monitor quick-broadcast drives the blotter (bi-directional)', async ({ context }) => {
  const blotter = await context.newPage();
  const monitor = await context.newPage();
  await openPanel(blotter, '/blotter/', /FDC3 shim/);
  await openPanel(monitor, '/monitor/', /FDC3 shim/);

  await monitor.click('button[data-symbol="TSLA"]');
  await expect(blotter.locator('#current')).toHaveText('TSLA');
  await expect(blotter.locator('#symbol')).toHaveValue('TSLA');
});

test('colour channels isolate context', async ({ context }) => {
  const blotter = await context.newPage();
  const monitor = await context.newPage();
  await openPanel(blotter, '/blotter/', /FDC3 shim/);
  await openPanel(monitor, '/monitor/', /FDC3 shim/);

  await monitor.click('.channel-dot[data-channel="red"]');
  await expect(monitor.locator('#channel')).toHaveText('red');

  await blotter.fill('#symbol', 'AAPL');
  await blotter.press('#symbol', 'Enter');
  await monitor.waitForTimeout(300);
  await expect(monitor.locator('#count')).toHaveText('0');

  await blotter.click('.channel-dot[data-channel="red"]');
  await blotter.fill('#symbol', 'MSFT');
  await blotter.press('#symbol', 'Enter');
  await expect(monitor.locator('#count')).toHaveText('1');
});

/**
 * Live Deephaven round trip. Needs a running Deephaven with the demo script
 * loaded; set DEEPHAVEN_URL=http://localhost:10000 to enable.
 */
const deephavenUrl = process.env.DEEPHAVEN_URL;
test.describe('Deephaven bridge (live)', () => {
  test.skip(!deephavenUrl, 'DEEPHAVEN_URL not set');

  test('instrument context from the blotter is written to symbol_filter and filters derived tables', async ({ context }) => {
    const bridge = await context.newPage();
    const blotter = await context.newPage();
    await bridge.goto(`/bridge/?server=${encodeURIComponent(deephavenUrl!)}`);
    await expect(bridge.locator('#status-badge')).toContainText('ready', { timeout: 45_000 });
    await openPanel(blotter, '/blotter/', /FDC3 shim/);

    const symbol = Date.now() % 2 === 0 ? 'META' : 'JPM';
    await blotter.fill('#symbol', symbol);
    await blotter.press('#symbol', 'Enter');

    await expect(bridge.locator('#last')).toHaveText(symbol);
    await expect(bridge.locator('#server-filter')).toHaveText(symbol, { timeout: 15_000 });

    // Independently verify through the Deephaven JS API that the derived
    // table now only contains the selected symbol.
    const seen = await bridge.evaluate(async ({ server, wanted }) => {
      const dh = (await import(/* @vite-ignore */ `${server}/jsapi/dh-core.js`)).default;
      const client = new dh.CoreClient(server);
      await client.login({ type: dh.CoreClient.LOGIN_TYPE_ANONYMOUS });
      const ide = await client.getAsIdeConnection();
      const table = await ide.getTable('quotes_filtered');
      const column = table.findColumn('Symbol');
      for (let attempt = 0; attempt < 40; attempt++) {
        table.setViewport(0, 19, [column]);
        const data = await table.getViewportData();
        const symbols = data.rows.map((row: { get(c: unknown): string }) => row.get(column));
        if (symbols.length && symbols.every((s: string) => s === wanted)) return symbols;
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    }, { server: deephavenUrl!, wanted: symbol });
    expect(seen).not.toBeNull();
  });
});
