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
 * Order Blotter — the FDC3 *publisher* in this demo.
 *
 * 1. Join a user channel (default: green).
 * 2. When the trader picks a symbol, broadcast an `fdc3.instrument` context.
 *    Every other panel on the same channel (the Interop monitor, the Deephaven
 *    bridge → Deephaven panels) reacts to it.
 * 3. Also *listen* for `fdc3.instrument` so the blotter follows the symbol
 *    when another app broadcasts (bi-directional linking).
 */

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const header = $('#header');
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

async function main() {
  const bus = await createFdc3Bus();
  setBadge(apiBadge, bus.api === 'fdc3' ? 'FDC3 2.0 · OpenFin' : 'FDC3 shim · browser', bus.api === 'fdc3' ? 'ok' : 'warn');
  $('#runtime').textContent = await describeRuntime();

  await bus.join(DEFAULT_CHANNEL_ID);
  paintChannel(header, DEFAULT_CHANNEL_ID);
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
}

main().catch((error) => {
  console.error(error);
  setBadge(apiBadge, `error: ${String(error)}`, 'warn');
});
