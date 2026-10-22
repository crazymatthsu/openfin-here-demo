import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRELOAD_ROUTE = '/preload/deephaven-bridge.js';
const preloadFile = fileURLToPath(new URL('./preload/deephaven-bridge.js', import.meta.url));

/**
 * Vite plugin that publishes the Deephaven FDC3 bridge preload script at
 * `/preload/deephaven-bridge.js` of the demo that uses it: served from this
 * package in `vite dev` / `vite preview`, emitted as a static asset in
 * `vite build`. The platform manifests reference that URL in `preloadScripts`.
 */
export function tradingPanelsPreload() {
  const serve = (server) => {
    server.middlewares.use((req, res, next) => {
      if ((req.url ?? '').split('?')[0] !== PRELOAD_ROUTE) return next();
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(readFileSync(preloadFile));
    });
  };
  return {
    name: 'trading-panels-preload',
    configureServer: serve,
    configurePreviewServer: serve,
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: PRELOAD_ROUTE.slice(1), source: readFileSync(preloadFile, 'utf8') });
    },
  };
}
