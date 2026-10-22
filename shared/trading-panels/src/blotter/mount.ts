import '../styles.css';
import { createFdc3Bus } from '../shared/bus';
import { DEFAULT_CHANNEL_ID } from '../shared/channels';
import { describeRuntime } from '../shared/env';
import {
  INSTRUMENT_CONTEXT_TYPE,
  INSTRUMENTS,
  instrumentContext,
  instrumentName,
  normalizeSymbol,
  symbolFromContext,
} from '../shared/instruments';
import { escapeHtml, mountChannelPicker, paintChannel, setBadge } from '../shared/ui';
import { basePrice, generateOrders, seededRandom, tickOrders, type Order, type Side } from './orders';

/**
 * Order Blotter — the FDC3 *publisher* in the demos.
 *
 * 1. Join a user channel (default: green).
 * 2. When the trader picks a symbol, broadcast an `fdc3.instrument` context.
 *    Every other panel on the same channel (the Interop monitor, the Deephaven
 *    bridge → Deephaven panels), in *any* window of the platform, reacts to it.
 * 3. Also *listen* for `fdc3.instrument` so the blotter follows the symbol
 *    when another app broadcasts (bi-directional linking).
 */

const TEMPLATE = `
  <header class="panel-header" data-ref="header">
    <h1>Order Blotter</h1>
    <span class="badge" id="api-badge" data-ref="api-badge">starting…</span>
    <span class="spacer"></span>
    <div id="channel-picker" data-ref="channel-picker" aria-label="User channel"></div>
  </header>
  <main>
    <div class="toolbar">
      <label for="symbol">Symbol</label>
      <input id="symbol" list="symbols" placeholder="e.g. AAPL" autocomplete="off" size="10" />
      <datalist id="symbols"></datalist>
      <button id="broadcast" class="primary" type="button">Broadcast</button>
      <button id="clear" type="button">Clear filter</button>
      <span class="current" id="current" title="Current instrument">—</span>
      <span class="hint" id="current-name"></span>
    </div>
    <form class="toolbar" id="ticket" autocomplete="off">
      <label>New order</label>
      <select id="t-side"><option>BUY</option><option>SELL</option></select>
      <input id="t-qty" type="number" min="100" step="100" value="500" size="6" />
      <span class="hint">@</span>
      <input id="t-price" type="number" min="0" step="0.01" placeholder="limit" size="8" />
      <button type="submit">Add order</button>
    </form>
    <div class="table-wrap">
      <table class="grid" id="orders">
        <thead>
          <tr><th>Time</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Filled</th><th class="num">Limit</th><th>Status</th><th>Trader</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </main>
  <footer class="statusbar"><span id="runtime"></span><span id="counts"></span></footer>
`;

export interface BlotterOptions {
  /** Channel to join at start-up. Default: green. */
  channel?: string;
  /** Panel title. Default: "Order Blotter". */
  title?: string;
}

/** Renders the blotter into `root` and wires it to FDC3. Resolves once connected. */
export async function mountBlotter(root: HTMLElement, options: BlotterOptions = {}): Promise<void> {
  root.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  if (options.title) $('h1').textContent = options.title;

  const header = $('[data-ref="header"]');
  const apiBadge = $('#api-badge');
  const symbolInput = $<HTMLInputElement>('#symbol');
  const datalist = $<HTMLDataListElement>('#symbols');
  const currentEl = $('#current');
  const currentNameEl = $('#current-name');
  const tbody = $('#orders tbody');
  const countsEl = $('#counts');
  const ticket = $<HTMLFormElement>('#ticket');

  const orders: Order[] = generateOrders();
  const rnd = seededRandom(99);
  let currentSymbol: string | null = null;
  let nextId = 2000;

  for (const instrument of INSTRUMENTS) {
    const option = document.createElement('option');
    option.value = instrument.ticker;
    option.label = instrument.name;
    datalist.appendChild(option);
  }

  function renderOrders() {
    const visible = currentSymbol ? orders.filter((o) => o.symbol === currentSymbol) : orders;
    tbody.innerHTML = visible
      .map(
        (o) => `<tr data-symbol="${o.symbol}" class="${o.symbol === currentSymbol ? 'selected' : ''}">
          <td>${o.time.toLocaleTimeString(undefined, { hour12: false })}</td>
          <td><b>${o.symbol}</b></td>
          <td class="side-${o.side}">${o.side}</td>
          <td class="num">${o.qty.toLocaleString()}</td>
          <td class="num">${o.filled.toLocaleString()}</td>
          <td class="num">${o.limit.toFixed(2)}</td>
          <td class="status-${o.status}">${o.status}</td>
          <td>${escapeHtml(o.trader)}</td>
        </tr>`,
      )
      .join('');
    countsEl.textContent = `${visible.length} of ${orders.length} orders${currentSymbol ? ` · filter ${currentSymbol}` : ''}`;
  }

  function applySymbol(symbol: string | null) {
    currentSymbol = symbol;
    currentEl.textContent = symbol ?? '—';
    currentNameEl.textContent = symbol ? (instrumentName(symbol) ?? '') : '';
    if (symbol) symbolInput.value = symbol;
    const price = symbol ? basePrice(symbol) : null;
    $<HTMLInputElement>('#t-price').value = price ? price.toFixed(2) : '';
    renderOrders();
  }

  try {
    const bus = await createFdc3Bus();
    setBadge(apiBadge, bus.api === 'fdc3' ? 'FDC3 2.0 · OpenFin' : 'FDC3 shim · browser', bus.api === 'fdc3' ? 'ok' : 'warn');
    $('#runtime').textContent = await describeRuntime();

    const channel = options.channel ?? DEFAULT_CHANNEL_ID;
    await bus.join(channel);
    paintChannel(header, channel);
    await mountChannelPicker($('#channel-picker'), bus, (id) => paintChannel(header, id));

    // Inbound: follow instrument contexts broadcast by any other app on the channel.
    await bus.listen(INSTRUMENT_CONTEXT_TYPE, (context) => {
      const symbol = symbolFromContext(context);
      if (symbol && symbol !== currentSymbol) applySymbol(symbol);
    });

    // Outbound: the trader picked a symbol.
    const select = async (raw: string) => {
      const symbol = normalizeSymbol(raw);
      if (!symbol) {
        symbolInput.setCustomValidity('Enter a ticker such as AAPL');
        symbolInput.reportValidity();
        return;
      }
      symbolInput.setCustomValidity('');
      applySymbol(symbol);
      await bus.broadcast(instrumentContext(symbol));
    };

    $('#broadcast').addEventListener('click', () => select(symbolInput.value));
    symbolInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        select(symbolInput.value);
      }
    });
    symbolInput.addEventListener('change', () => {
      // Fires when a datalist entry is picked with the mouse.
      if (normalizeSymbol(symbolInput.value) && INSTRUMENTS.some((i) => i.ticker === symbolInput.value.toUpperCase())) {
        select(symbolInput.value);
      }
    });
    $('#clear').addEventListener('click', () => {
      applySymbol(null);
      symbolInput.value = '';
    });
    tbody.addEventListener('click', (event) => {
      const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-symbol]');
      if (row?.dataset.symbol) select(row.dataset.symbol);
    });

    ticket.addEventListener('submit', (event) => {
      event.preventDefault();
      const symbol = currentSymbol ?? normalizeSymbol(symbolInput.value);
      if (!symbol) return select(symbolInput.value);
      const side = $<HTMLSelectElement>('#t-side').value as Side;
      const qty = Number($<HTMLInputElement>('#t-qty').value) || 100;
      const limit = Number($<HTMLInputElement>('#t-price').value) || basePrice(symbol);
      orders.unshift({ id: nextId++, time: new Date(), symbol, side, qty, filled: 0, limit, status: 'Working', trader: 'ME' });
      renderOrders();
    });

    setInterval(() => {
      tickOrders(orders, rnd);
      renderOrders();
    }, 2000);

    renderOrders();
    symbolInput.focus();
  } catch (error) {
    console.error(error);
    setBadge(apiBadge, `error: ${String(error)}`, 'warn');
    throw error;
  }
}
