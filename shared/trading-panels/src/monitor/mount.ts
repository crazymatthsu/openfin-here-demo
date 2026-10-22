import '../styles.css';
import { createPreferredBus } from '../shared/bus';
import { DEFAULT_CHANNEL_ID } from '../shared/channels';
import { describeRuntime } from '../shared/env';
import { INSTRUMENTS, instrumentContext } from '../shared/instruments';
import { createLog, mountChannelPicker, paintChannel, setBadge } from '../shared/ui';

/**
 * Interop Monitor — a *subscriber* that uses OpenFin's raw Interop API
 * (`fin.me.interop`) when it runs inside Here Core, so you can see that
 * contexts broadcast with `fdc3.broadcast()` by the blotter arrive through
 * `fin.me.interop.addContextHandler()` as well: FDC3 is a façade over the
 * Interop Broker. Because the broker belongs to the platform, not to a window,
 * this works across every window of the platform.
 *
 * In a plain browser the same panel falls back to the FDC3 shim.
 */

const TEMPLATE = `
  <header class="panel-header" data-ref="header">
    <h1>Interop Monitor</h1>
    <span class="badge" id="api-badge">starting…</span>
    <span class="spacer"></span>
    <div id="channel-picker" aria-label="User channel"></div>
  </header>
  <main>
    <div class="toolbar" id="quick">
      <label>Quick broadcast</label>
    </div>
    <dl class="kv">
      <dt>Runtime</dt><dd id="runtime">…</dd>
      <dt>API in use</dt><dd id="api">…</dd>
      <dt>Channel</dt><dd id="channel">…</dd>
      <dt>Contexts seen</dt><dd id="count">0</dd>
    </dl>
    <div class="toolbar"><label>Context log (newest first)</label><span class="spacer"></span><button id="clear" type="button">Clear</button></div>
    <div class="log" id="log"></div>
  </main>
  <footer class="statusbar"><span>Listens to every context type on the joined channel.</span></footer>
`;

export interface MonitorOptions {
  channel?: string;
  title?: string;
}

/** Renders the monitor into `root` and subscribes to the broker. */
export async function mountMonitor(root: HTMLElement, options: MonitorOptions = {}): Promise<void> {
  root.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  if (options.title) $('h1').textContent = options.title;
  const header = $('[data-ref="header"]');
  const apiBadge = $('#api-badge');
  const log = createLog($('#log'));
  let seen = 0;

  try {
    const bus = await createPreferredBus('interop');
    const apiLabel = { 'openfin-interop': 'Interop API · fin.me.interop', fdc3: 'FDC3 2.0 · window.fdc3', 'fdc3-shim': 'FDC3 shim · browser' }[bus.api];
    setBadge(apiBadge, apiLabel, bus.api === 'fdc3-shim' ? 'warn' : 'ok');
    $('#api').textContent = apiLabel;
    $('#runtime').textContent = await describeRuntime();

    const channel = options.channel ?? DEFAULT_CHANNEL_ID;
    await bus.join(channel);
    $('#channel').textContent = channel;
    paintChannel(header, channel);
    await mountChannelPicker($('#channel-picker'), bus, (id) => {
      $('#channel').textContent = id;
      paintChannel(header, id);
      log.push({ direction: 'info', label: `joined channel ${id}` });
    });

    // null = every context type
    await bus.listen(null, (context) => {
      seen += 1;
      $('#count').textContent = String(seen);
      log.push({ direction: 'in', label: `received ${context.type}`, context });
    });

    const quick = $('#quick');
    for (const instrument of INSTRUMENTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = instrument.ticker;
      button.dataset.symbol = instrument.ticker;
      button.addEventListener('click', async () => {
        const context = instrumentContext(instrument.ticker);
        await bus.broadcast(context);
        log.push({ direction: 'out', label: `broadcast via ${bus.api}`, context });
      });
      quick.appendChild(button);
    }
    $('#clear').addEventListener('click', () => log.clear());
    log.push({ direction: 'info', label: `ready on channel ${channel}` });
  } catch (error) {
    console.error(error);
    setBadge(apiBadge, `error: ${String(error)}`, 'warn');
    throw error;
  }
}
