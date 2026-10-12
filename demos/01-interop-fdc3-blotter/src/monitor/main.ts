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
 * Interop Broker.
 *
 * In a plain browser the same page falls back to the FDC3 shim.
 */

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const header = $('#header');
const apiBadge = $('#api-badge');
const log = createLog($('#log'));
let seen = 0;

async function main() {
  const bus = await createPreferredBus('interop');
  const apiLabel = { 'openfin-interop': 'Interop API · fin.me.interop', fdc3: 'FDC3 2.0 · window.fdc3', 'fdc3-shim': 'FDC3 shim · browser' }[bus.api];
  setBadge(apiBadge, apiLabel, bus.api === 'fdc3-shim' ? 'warn' : 'ok');
  $('#api').textContent = apiLabel;
  $('#runtime').textContent = await describeRuntime();

  await bus.join(DEFAULT_CHANNEL_ID);
  $('#channel').textContent = DEFAULT_CHANNEL_ID;
  paintChannel(header, DEFAULT_CHANNEL_ID);
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
  log.push({ direction: 'info', label: `ready on channel ${DEFAULT_CHANNEL_ID}` });
}

main().catch((error) => {
  console.error(error);
  setBadge(apiBadge, `error: ${String(error)}`, 'warn');
});
