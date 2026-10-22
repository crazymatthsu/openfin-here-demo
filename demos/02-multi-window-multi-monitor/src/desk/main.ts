import '@openfin-here-demo/trading-panels/styles.css';
import { createFdc3Bus } from '@openfin-here-demo/trading-panels/shared/bus';
import { DEFAULT_CHANNELS, DEFAULT_CHANNEL_ID, channelColor } from '@openfin-here-demo/trading-panels/shared/channels';
import { describeRuntime, isOpenFin } from '@openfin-here-demo/trading-panels/shared/env';
import { INSTRUMENT_CONTEXT_TYPE, instrumentName, symbolFromContext } from '@openfin-here-demo/trading-panels/shared/instruments';
import { createLog, escapeHtml, setBadge } from '@openfin-here-demo/trading-panels/shared/ui';
import { boundsOn, describeScreen, listScreens, screenOf, type Bounds, type Screen } from '../platform/placement';

/**
 * Desk Controller — the panel that makes the two-window set-up visible and
 * controllable from inside the platform.
 *
 * - **Sync status** (works everywhere): listens for `fdc3.instrument` and
 *   shows the symbol both windows are on.
 * - **Desk channel**: moves *every view in every window* to a colour channel
 *   with `fin.me.interop.joinContextGroup(id, viewIdentity)`, the platform-level
 *   form of the Interop API.
 * - **Screens and windows** (Here Core only): `fin.System.getMonitorInfo()`,
 *   `fin.Application.getCurrentSync().getChildWindows()`, `Window.setBounds()`.
 * - **Layouts**: `platform.getSnapshot()` / `applySnapshot()` to save and
 *   restore where the windows are, `platform.createWindow()` to bring back a
 *   closed window from the manifest.
 */

const LAYOUT_KEY = 'openfin-here-demo.demo02.layout';
const DESK_WINDOWS = ['trading-desk', 'market-data'] as const;

const TEMPLATE = `
  <header class="panel-header" data-ref="header">
    <h1>Desk Controller</h1>
    <span class="badge" id="runtime-badge">starting…</span>
    <span class="spacer"></span>
    <span class="hint">instrument</span>
    <span class="current" id="symbol">—</span>
    <span class="hint" id="symbol-name"></span>
  </header>
  <main>
    <div class="toolbar">
      <label>Desk channel</label>
      <span id="desk-channel-picker" class="channel-picker"></span>
      <span class="hint" id="desk-channel">every view in every window joins the chosen colour</span>
    </div>
    <p class="hint" id="notice" hidden></p>
    <div class="toolbar"><label>Screens</label><span class="spacer"></span><button id="refresh" type="button">Refresh</button></div>
    <div class="table-wrap" style="flex:0 0 auto">
      <table class="grid" id="screens"><thead><tr><th>#</th><th>Role</th><th>Size (DIP)</th><th>Scale</th><th>Origin</th><th>Windows</th></tr></thead><tbody></tbody></table>
    </div>
    <div class="toolbar"><label>Windows</label></div>
    <div class="table-wrap" style="flex:0 0 auto">
      <table class="grid" id="windows"><thead><tr><th>Window</th><th>Role</th><th>On</th><th>Bounds</th><th>Views</th><th>Move to</th><th></th></tr></thead><tbody></tbody></table>
    </div>
    <div class="toolbar">
      <button id="swap" type="button">Swap screens</button>
      <button id="tile" type="button">Tile on primary</button>
      <span class="spacer"></span>
      <button id="save" type="button">Save layout</button>
      <button id="restore" type="button">Restore layout</button>
      <button id="reset" type="button">Reset to manifest</button>
    </div>
    <div class="log" id="log"></div>
  </main>
  <footer class="statusbar"><span id="runtime"></span></footer>
`;

interface WindowRow {
  name: string;
  role: string;
  bounds: Bounds;
  screen: Screen;
  views: OpenFin.Identity[];
  win: OpenFin.Window;
}

interface ManifestLike {
  snapshot?: { windows?: Array<OpenFin.PlatformWindowCreationOptions & { name: string }> };
}

const root = document.body;
root.innerHTML = TEMPLATE;
const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const log = createLog($('#log'));

function paintDeskChannel(id: string) {
  $('[data-ref="header"]').style.setProperty('--channel', channelColor(id));
  $('#desk-channel').textContent = `all views on ${id}`;
  for (const dot of root.querySelectorAll<HTMLButtonElement>('#desk-channel-picker .channel-dot')) {
    dot.setAttribute('aria-pressed', String(dot.dataset.channel === id));
  }
}

async function main() {
  $('#runtime').textContent = await describeRuntime();

  // ---- 1. Sync status: FDC3 works in Here Core and in browser mode alike.
  const bus = await createFdc3Bus();
  await bus.join(DEFAULT_CHANNEL_ID);
  await bus.listen(INSTRUMENT_CONTEXT_TYPE, (context) => {
    const symbol = symbolFromContext(context);
    if (!symbol) return;
    $('#symbol').textContent = symbol;
    $('#symbol-name').textContent = instrumentName(symbol) ?? '';
    log.push({ direction: 'in', label: 'instrument context seen by this window', context });
  });

  // ---- 2. Desk-wide channel buttons.
  const picker = $('#desk-channel-picker');
  for (const channel of DEFAULT_CHANNELS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'channel-dot';
    button.dataset.action = 'desk-channel';
    button.dataset.channel = channel.id;
    button.title = `Move every view in every window to ${channel.name}`;
    button.style.setProperty('--dot', channel.color);
    picker.appendChild(button);
  }
  paintDeskChannel(DEFAULT_CHANNEL_ID);

  if (!isOpenFin()) {
    setBadge($('#runtime-badge'), 'browser mode', 'warn');
    const notice = $('#notice');
    notice.hidden = false;
    notice.textContent =
      'Screen and window management needs the Here Core runtime (fin.System.getMonitorInfo, Window.setBounds, Platform snapshots). ' +
      'In this browser only the instrument sync status above is live.';
    for (const button of root.querySelectorAll<HTMLButtonElement>('button:not([data-action="desk-channel"])')) button.disabled = true;
    picker.addEventListener('click', async (event) => {
      const dot = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="desk-channel"]');
      if (!dot?.dataset.channel) return;
      await bus.join(dot.dataset.channel);
      paintDeskChannel(dot.dataset.channel);
      log.push({ direction: 'info', label: `this panel joined ${dot.dataset.channel} (browser mode: other tabs keep their own channel)` });
    });
    return;
  }

  // ---- 3. Here Core only from here on.
  setBadge($('#runtime-badge'), 'Here Core', 'ok');
  const app = fin.Application.getCurrentSync();
  const platform = fin.Platform.getCurrentSync();
  let screens: Screen[] = [];
  let windows: WindowRow[] = [];

  async function listWindows(info: OpenFin.MonitorInfo): Promise<WindowRow[]> {
    const rows: WindowRow[] = [];
    for (const win of await app.getChildWindows()) {
      try {
        const [options, bounds, views] = await Promise.all([win.getOptions(), win.getBounds(), win.getCurrentViews()]);
        const customData = (options.customData ?? {}) as Record<string, unknown>;
        const role = typeof customData.role === 'string' ? customData.role : '';
        const b: Bounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
        rows.push({ name: win.identity.name, role, bounds: b, screen: screenOf(info, b), views: views.map((v) => v.identity), win });
      } catch (error) {
        console.warn('[desk] skipping window', win.identity, error);
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  function render() {
    $('#screens tbody').innerHTML = screens
      .map((s) => {
        const r = s.monitorRect;
        const names = windows.filter((w) => w.screen.index === s.index).map((w) => w.name).join(', ') || '—';
        return `<tr><td>${s.index}</td><td>${s.isPrimary ? 'primary' : 'secondary'}</td><td class="num">${r.right - r.left}×${r.bottom - r.top}</td><td class="num">${s.deviceScaleFactor}×</td><td class="num">(${r.left}, ${r.top})</td><td>${escapeHtml(names)}</td></tr>`;
      })
      .join('');

    const present = new Set(windows.map((w) => w.name));
    const rows = windows.map(
      (w) => `<tr data-window="${escapeHtml(w.name)}">
        <td><b>${escapeHtml(w.name)}</b></td><td>${escapeHtml(w.role)}</td>
        <td>Screen ${w.screen.index}</td>
        <td class="num">${w.bounds.width}×${w.bounds.height} @ (${w.bounds.left}, ${w.bounds.top})</td>
        <td>${w.views.length}</td>
        <td>${screens.map((s) => `<button type="button" data-action="move" data-window="${escapeHtml(w.name)}" data-screen="${s.index}" ${s.index === w.screen.index ? 'disabled' : ''}>Screen ${s.index}</button>`).join(' ')}</td>
        <td><button type="button" data-action="front" data-window="${escapeHtml(w.name)}">Front</button></td>
      </tr>`,
    );
    for (const name of DESK_WINDOWS) {
      if (!present.has(name)) {
        rows.push(
          `<tr data-window="${name}"><td><b>${name}</b></td><td colspan="4" class="status-Cancelled">closed</td><td colspan="2"><button type="button" data-action="reopen" data-window="${name}">Re-open from manifest</button></td></tr>`,
        );
      }
    }
    $('#windows tbody').innerHTML = rows.join('');
  }

  async function refresh() {
    const info = await fin.System.getMonitorInfo();
    screens = listScreens(info);
    windows = await listWindows(info);
    render();
  }

  const byName = (name: string) => windows.find((w) => w.name === name);
  const screenByIndex = (index: number) => screens.find((s) => s.index === index);

  async function moveTo(name: string, screen: Screen, slot: 'full' | 'left' | 'right' = 'full') {
    const row = byName(name);
    if (!row) return;
    const bounds = boundsOn(screen, slot);
    await row.win.setBounds(bounds);
    await row.win.bringToFront();
    log.push({ direction: 'info', label: `${name} → ${describeScreen(screen)}${slot === 'full' ? '' : ` (${slot} half)`}` });
  }

  async function loadManifest(): Promise<ManifestLike> {
    const response = await fetch('/manifest.fin.json', { cache: 'no-store' });
    return (await response.json()) as ManifestLike;
  }

  root.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const { action, window: name, screen, channel } = button.dataset;
    try {
      switch (action) {
        case 'move': {
          const target = screenByIndex(Number(screen));
          if (name && target) await moveTo(name, target);
          break;
        }
        case 'front':
          await byName(name ?? '')?.win.bringToFront();
          break;
        case 'reopen': {
          const manifest = await loadManifest();
          const definition = manifest.snapshot?.windows?.find((w) => w.name === name);
          if (!definition) throw new Error(`window "${name}" not found in manifest`);
          await platform.createWindow(definition);
          log.push({ direction: 'info', label: `re-opened ${name} from the manifest (provider places it by its screen hint)` });
          break;
        }
        case 'desk-channel': {
          if (!channel) return;
          let count = 0;
          for (const w of windows) {
            for (const view of w.views) {
              await fin.me.interop.joinContextGroup(channel, view);
              count += 1;
            }
          }
          await bus.join(channel);
          paintDeskChannel(channel);
          log.push({ direction: 'info', label: `joined ${count} views in ${windows.length} windows to ${channel}` });
          break;
        }
      }
      await refresh();
    } catch (error) {
      console.error(error);
      log.push({ direction: 'info', label: `error: ${String(error)}` });
    }
  });

  $('#refresh').addEventListener('click', refresh);

  $('#swap').addEventListener('click', async () => {
    const desk = byName('trading-desk');
    const data = byName('market-data');
    if (!desk || !data) return log.push({ direction: 'info', label: 'both desk windows must be open to swap' });
    if (desk.screen.index === data.screen.index) {
      await moveTo('trading-desk', desk.screen, 'right');
      await moveTo('market-data', data.screen, 'left');
    } else {
      const [a, b] = [desk.screen, data.screen];
      await moveTo('trading-desk', b);
      await moveTo('market-data', a);
    }
    await refresh();
  });

  $('#tile').addEventListener('click', async () => {
    const primary = screens.find((s) => s.isPrimary);
    if (!primary) return;
    await moveTo('trading-desk', primary, 'left');
    await moveTo('market-data', primary, 'right');
    await refresh();
  });

  $('#save').addEventListener('click', async () => {
    const snapshot = await platform.getSnapshot();
    for (const w of snapshot.windows) {
      // keep the user's positions on restore: tell the provider not to auto-place these windows
      w.customData = { ...((w.customData as Record<string, unknown> | undefined) ?? {}), autoPlace: false };
    }
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(snapshot));
    log.push({ direction: 'info', label: `saved layout with ${snapshot.windows.length} windows to localStorage` });
  });

  $('#restore').addEventListener('click', async () => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (!saved) return log.push({ direction: 'info', label: 'no saved layout yet' });
    log.push({ direction: 'info', label: 'restoring saved layout (closes current windows)' });
    await platform.applySnapshot(JSON.parse(saved) as OpenFin.Snapshot, { closeExistingWindows: true });
  });

  $('#reset').addEventListener('click', async () => {
    const manifest = await loadManifest();
    if (!manifest.snapshot) return;
    log.push({ direction: 'info', label: 'resetting to the manifest layout (closes current windows)' });
    await platform.applySnapshot(manifest.snapshot as OpenFin.Snapshot, { closeExistingWindows: true });
  });

  await fin.System.on('monitor-info-changed', () => {
    log.push({ direction: 'info', label: 'monitor layout changed' });
    void refresh();
  });
  await refresh();
  setInterval(() => void refresh(), 5000);
  log.push({ direction: 'info', label: `ready: ${screens.length} screen(s), ${windows.length} window(s)` });
}

main().catch((error) => {
  console.error(error);
  setBadge($('#runtime-badge'), `error: ${String(error)}`, 'warn');
});
