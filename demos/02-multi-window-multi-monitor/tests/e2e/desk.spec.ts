import { expect, test, type Page } from '@playwright/test';
import { installFinMock, type FinMockConfig } from './fin-mock';

/**
 * Desk Controller tests. The `fin` API is mocked (tests/e2e/fin-mock.ts)
 * so the window/monitor logic can be exercised in plain Chromium. The
 * instrument sync uses the real FDC3 shim shared with the blotter page.
 */

interface MockState {
  calls: unknown[][];
  windows: Record<string, { bounds: { left: number; top: number; width: number; height: number } }>;
}

async function openDesk(page: Page, config: FinMockConfig = { monitors: 2 }) {
  await page.addInitScript(installFinMock, config);
  await page.goto('/desk/');
  await expect(page.locator('#runtime-badge')).toHaveText('Here Core', { timeout: 15_000 });
  await expect(page.locator('#windows tbody tr')).toHaveCount(2);
}

const mockState = (page: Page) => page.evaluate(() => (window as unknown as { __finMock: MockState }).__finMock);
const callsNamed = (state: MockState, name: string) => state.calls.filter((c) => c[0] === name);

test('lists screens and the window on each of them', async ({ page }) => {
  await openDesk(page);
  const screens = page.locator('#screens tbody tr');
  await expect(screens).toHaveCount(2);
  await expect(screens.nth(0)).toContainText('primary');
  await expect(screens.nth(0)).toContainText('2560×1440');
  await expect(screens.nth(0)).toContainText('trading-desk');
  await expect(screens.nth(1)).toContainText('1.25×');
  await expect(screens.nth(1)).toContainText('market-data');
  await expect(page.locator('#windows tr[data-window="market-data"]')).toContainText('Screen 2');
  await expect(page.locator('#windows tr[data-window="trading-desk"]')).toContainText('Screen 1');
});

test('moves a window to another screen with Window.setBounds', async ({ page }) => {
  await openDesk(page);
  await page.click('button[data-action="move"][data-window="market-data"][data-screen="1"]');
  await expect(page.locator('#windows tr[data-window="market-data"]')).toContainText('Screen 1');
  const state = await mockState(page);
  const moves = callsNamed(state, 'setBounds');
  expect(moves).toHaveLength(1);
  const bounds = moves[0]![2] as { left: number; width: number; top: number; height: number };
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.left + bounds.width).toBeLessThanOrEqual(2560);
  expect(bounds.top + bounds.height).toBeLessThanOrEqual(1400);
  expect(callsNamed(state, 'bringToFront')).toHaveLength(1);
});

test('swaps the two windows between screens', async ({ page }) => {
  await openDesk(page);
  await page.click('#swap');
  await expect(page.locator('#windows tr[data-window="trading-desk"]')).toContainText('Screen 2');
  await expect(page.locator('#windows tr[data-window="market-data"]')).toContainText('Screen 1');
});

test('tiles both windows side by side on a single screen', async ({ page }) => {
  await openDesk(page, { monitors: 1 });
  await expect(page.locator('#screens tbody tr')).toHaveCount(1);
  await page.click('#tile');
  const state = await mockState(page);
  const desk = state.windows['trading-desk']!.bounds;
  const data = state.windows['market-data']!.bounds;
  expect(desk.left + desk.width).toBeLessThanOrEqual(data.left);
  expect(data.left + data.width).toBeLessThanOrEqual(2560);
});

test('desk channel moves every view of every window with joinContextGroup', async ({ page }) => {
  await openDesk(page);
  await page.click('button[data-action="desk-channel"][data-channel="red"]');
  await expect(page.locator('#desk-channel')).toHaveText('all views on red');
  const state = await mockState(page);
  const joins = callsNamed(state, 'joinContextGroup').filter((c) => c[1] === 'red');
  const targets = joins.map((c) => c[2]).sort();
  expect(targets).toEqual(
    ['order-blotter', 'desk-controller', 'interop-monitor', 'dh-quotes', 'dh-chart', 'dh-trades', 'dh-positions', 'dh-filter-state'].sort(),
  );
});

test('saves the layout with autoPlace=false and restores it with applySnapshot', async ({ page }) => {
  await openDesk(page);
  await page.click('#save');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('openfin-here-demo.demo02.layout') ?? 'null'));
  expect(saved.windows).toHaveLength(2);
  for (const w of saved.windows) expect(w.customData.autoPlace).toBe(false);
  await page.click('#restore');
  const state = await mockState(page);
  const applies = callsNamed(state, 'applySnapshot');
  expect(applies).toHaveLength(1);
  expect(applies[0]![2]).toEqual({ closeExistingWindows: true });
});

test('re-opens a closed desk window from the manifest', async ({ page }) => {
  await openDesk(page);
  await page.evaluate(() => (window as unknown as { __finMock: { closeWindow(n: string): void } }).__finMock.closeWindow('market-data'));
  await page.click('#refresh');
  const row = page.locator('#windows tr[data-window="market-data"]');
  await expect(row).toContainText('closed');
  await row.locator('button[data-action="reopen"]').click();
  await expect(row).not.toContainText('closed');
  const state = await mockState(page);
  expect(callsNamed(state, 'createWindow')).toEqual([['createWindow', 'market-data']]);
});

test('instrument chosen in the blotter window shows up in the desk controller', async ({ context }) => {
  const desk = await context.newPage();
  await openDesk(desk);
  const blotter = await context.newPage();
  await blotter.goto('/blotter/');
  await expect(blotter.locator('#api-badge')).toContainText('FDC3 shim', { timeout: 15_000 });
  await blotter.fill('#symbol', 'META');
  await blotter.press('#symbol', 'Enter');
  await expect(desk.locator('#symbol')).toHaveText('META');
  await expect(desk.locator('#symbol-name')).toHaveText('Meta Platforms Inc.');
});

test('browser mode explains what needs the runtime but keeps the sync status', async ({ page }) => {
  await page.goto('/desk/');
  await expect(page.locator('#runtime-badge')).toHaveText('browser mode', { timeout: 15_000 });
  await expect(page.locator('#notice')).toContainText('Here Core');
  await expect(page.locator('#swap')).toBeDisabled();
});
