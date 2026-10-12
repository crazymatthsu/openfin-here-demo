import { getFdc3 } from '../shared/fdc3';
import { setBadge } from '../shared/ui';

/**
 * Browser-mode host for the Deephaven bridge.
 *
 * Inside OpenFin the bridge runs as a *preload script* injected into the
 * Deephaven view itself (see public/manifest.fin.json), where it uses the
 * Interop API. In a plain browser there is no preload mechanism, so this page
 * installs the FDC3 shim, then loads the very same script with a classic
 * <script> tag. The script detects that `fin` is absent and uses `window.fdc3`.
 */

interface BridgeState {
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
      ready: Promise<void>;
    };
  }
}

const params = new URLSearchParams(location.search);
const serverUrl = (params.get('server') ?? 'http://localhost:10000').replace(/\/$/, '');
const channel = params.get('channel') ?? 'green';
const $ = (id: string) => document.getElementById(id)!;

$('server').textContent = serverUrl;
($('dh') as HTMLIFrameElement).src = `${serverUrl}/iframe/widget/?name=symbol_filter`;

function render(state: BridgeState) {
  setBadge($('status-badge'), `${state.status} · channel ${state.channel}`, state.status === 'ready' ? 'ok' : state.status === 'error' ? 'warn' : 'muted');
  $('transport').textContent = state.transport ?? '…';
  $('last').textContent = state.lastSymbol ?? '—';
  $('server-filter').textContent = state.serverSymbol ?? '—';
  $('writes').textContent = String(state.writes);
  $('error').textContent = state.error ?? '—';
}

async function main() {
  // 1. Make sure window.fdc3 exists (OpenFin's, or the shim) before the bridge script runs.
  await getFdc3();
  // 2. Configure and load the bridge script. `overlay: false` because this page renders the state itself.
  window.__DH_FDC3_BRIDGE__ = { serverUrl, channel, overlay: false };
  window.addEventListener('dh-fdc3-bridge', (event) => render((event as CustomEvent<BridgeState>).detail));
  const script = document.createElement('script');
  script.src = '/preload/deephaven-bridge.js';
  document.head.appendChild(script);
}

main().catch((error) => setBadge($('status-badge'), `error: ${String(error)}`, 'warn'));
