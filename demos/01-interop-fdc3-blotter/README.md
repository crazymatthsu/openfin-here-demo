# Demo 01 · Interop API + FDC3 trading blotter

An equities **order blotter** running in a Here Core platform. Selecting a
symbol broadcasts an FDC3 `fdc3.instrument` context; an **Interop Monitor**
panel (raw Interop API) and four embedded **Deephaven** panels (quotes,
trades, positions, price chart) follow it. The Deephaven side is driven by a
Here Core **preload script** that writes the symbol into a Deephaven input
table, from which every panel is filtered server-side with `where_in`.

Documentation lives in [`../../docs/01-interop-fdc3-blotter/`](../../docs/01-interop-fdc3-blotter/):

- [Technical details](../../docs/01-interop-fdc3-blotter/01-technical-details.md)
- [Implementation plan and status](../../docs/01-interop-fdc3-blotter/02-implementation-plan.md)
- [Running on macOS and Windows](../../docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md)

## Run

```bash
# 1. Deephaven                         (see deephaven/README.md)
cd deephaven && docker compose up      # or ./start.sh / .\start.ps1
# 2. web app (from this folder)
npm run dev                            # http://localhost:5173
# 3. Here Core
npm run launch                         # openfin --launch --config http://localhost:5173/manifest.fin.json
```

Browser mode without Here Core: open <http://localhost:5173/> and follow the links.

## Layout of this folder

| Path | Purpose |
|------|---------|
| `public/manifest.fin.json` | Platform manifest: runtime, provider, view layout, preload script |
| `public/preload/deephaven-bridge.js` | Preload script: Interop API → Deephaven input table |
| `platform/`, `src/platform/` | Platform provider (`fin.Platform.init` + broker override) |
| `blotter/`, `src/blotter/` | Order blotter (FDC3 publisher) |
| `monitor/`, `src/monitor/` | Interop monitor (Interop API subscriber) |
| `bridge/`, `src/bridge/` | Browser-mode host for the preload script |
| `src/shared/` | FDC3 resolver + shim, context bus, instruments, UI helpers |
| `deephaven/` | Deephaven script, app-mode descriptor, embedded-server runner, Docker Compose |
| `tests/` | Vitest unit tests, Playwright e2e tests |

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server on port 5173 (pinned) |
| `npm run build` / `npm run preview` | Production build / serve it |
| `npm run launch` | Launch the platform in Here Core via `openfin-cli` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright browser-mode tests (`DEEPHAVEN_URL=http://localhost:10000` adds the live Deephaven test) |
