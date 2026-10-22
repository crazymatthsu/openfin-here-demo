import '../styles.css';
import { getFdc3 } from '../shared/fdc3';
import { setBadge } from '../shared/ui';

/**
 * Browser-mode host for the Deephaven bridge.
 *
 * Inside Here Core the bridge runs as a *preload script* injected into the
 * Deephaven view itself (see the demos' manifest.fin.json), where it uses the
 * Interop API. In a plain browser there is no preload mechanism, so this page
 * installs the FDC3 shim, then loads the very same script with a classic
 * <script> tag. The script detects that `fin` is absent and uses `window.fdc3`.
 */

export interface BridgeState {
  status: string;
  transport: string | null;
  channel: string;
  lastSymbol: string | null;
  serverSymbol: string | null;
  writes: number;
  error: string | null;
}

declare global {
  interface Window {
    __DH_FDC3_BRIDGE__?: Record<string, unknown>;
    __dhFdc3Bridge?: {
      getState(): BridgeState;
      setSymbol(symbol: string): Promise<void>;
      setChannel(channelId: string): Promise<void>;
      ready: Promise<void>;
    };
  }
}

const TEMPLATE = `
  <header class="panel-header">
    <h1>Deephaven FDC3 Bridge (browser mode)</h1>
    <span class="badge" id="status-badge">starting…</span>
    <span class="spacer"></span>
    <span class="hint" id="server"></span>
  </header>
  <main>
    <dl class="kv">
      <dt>Transport</dt><dd id="transport">…</dd>
      <dt>Last context</dt><dd id="last">—</dd>
      <dt>Server-side filter</dt><dd id="server-filter">—</dd>
      <dt>Writes</dt><dd id="writes">0</dd>
      <dt>Error</dt><dd id="error">—</dd>
    </dl>
    <p class="hint">
      This page hosts the same <code>preload/deephaven-bridge.js</code> that Here Core injects into the
      Deephaven view. Below is Deephaven's own embed of the <code>symbol_filter</code> input table, so you can
      watch the server-side filter row change when the blotter broadcasts.
    </p>
    <iframe id="dh" title="Deephaven symbol_filter" style="flex:1;border:0;background:#1b1b1f;min-height:0"></iframe>
  </main>
`;

export interface BridgeHostOptions {
  /** Deephaven server URL. Default: `?server=` query parameter or http://localhost:10000. */
  serverUrl?: string;
  /** Channel to join. Default: `?channel=` query parameter or green. */
  channel?: string;
  /** URL of the preload script. Default: /preload/deephaven-bridge.js. */
  scriptUrl?: string;
}

/** Renders the bridge host page into `root` and loads the preload script in page mode. */
export async function mountBridgeHost(root: HTMLElement, options: BridgeHostOptions = {}): Promise<void> {
  root.innerHTML = TEMPLATE;
  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const params = new URLSearchParams(location.search);
  const serverUrl = (options.serverUrl ?? params.get('server') ?? 'http://localhost:10000').replace(/\/$/, '');
  const channel = options.channel ?? params.get('channel') ?? 'green';

  $('server').textContent = serverUrl;
  ($('dh') as HTMLIFrameElement).src = `${serverUrl}/iframe/widget/?name=symbol_filter`;

  const render = (state: BridgeState) => {
    setBadge($('status-badge'), `${state.status} · channel ${state.channel}`, state.status === 'ready' ? 'ok' : state.status === 'error' ? 'warn' : 'muted');
    $('transport').textContent = state.transport ?? '…';
    $('last').textContent = state.lastSymbol ?? '—';
    $('server-filter').textContent = state.serverSymbol ?? '—';
    $('writes').textContent = String(state.writes);
    $('error').textContent = state.error ?? '—';
  };

  try {
    // 1. Make sure window.fdc3 exists (OpenFin's, or the shim) before the bridge script runs.
    await getFdc3();
    // 2. Configure and load the bridge script. `overlay: false` because this page renders the state itself.
    window.__DH_FDC3_BRIDGE__ = { serverUrl, channel, overlay: false };
    window.addEventListener('dh-fdc3-bridge', (event) => render((event as CustomEvent<BridgeState>).detail));
    const script = document.createElement('script');
    script.src = options.scriptUrl ?? '/preload/deephaven-bridge.js';
    document.head.appendChild(script);
  } catch (error) {
    setBadge($('status-badge'), `error: ${String(error)}`, 'warn');
    throw error;
  }
}
