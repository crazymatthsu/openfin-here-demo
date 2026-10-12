# Demo 01 · Implementation plan and status

The demo was built in the steps below, in order. Each step lists what it
produces, where the code lives and how it was verified. Status legend:
**done** = implemented and verified in this repository; **manual** = needs a
machine with Here Core, see the last section.

## Step 0 — Repository skeleton (done)

- Root `package.json` with npm workspaces (`demos/*`), `.gitignore`, `.editorconfig`, `demos/README.md` catalog, `docs/` folder.
- Verified: `npm install` at the root installs the demo workspace; `npm run build`/`test`/`typecheck` fan out.

## Step 1 — Deephaven data model (done)

Goal: a server with ticking tables and a single *switch* a client can flip.

- `deephaven/app.d/fdc3_blotter.py`
  - `quotes` (every 500 ms), `trades` (every 1 s), `positions` (aggregated), `instruments` (static).
  - `symbol_filter`: keyed input table `{Slot, Symbol}` seeded with `AAPL`.
  - `*_filtered` tables and `price_chart` derived with `where_in(symbol_filter, "Symbol")`.
  - Optional `blotter_dashboard` (deephaven.ui) when the plugin is installed.
- `deephaven/app.d/fdc3_blotter.app` (application-mode descriptor for Docker).
- `deephaven/run_server.py` (embedded server for pip), `requirements.txt`, `start.sh`, `start.ps1`, `docker-compose.yml`.
- Verified: started with `run_server.py` (deephaven-server 42.6, Java 21); the script loads without error; `/iframe/widget/?name=quotes_filtered`, `price_chart`, `positions_filtered`, `symbol_filter` and `blotter_dashboard` all render (screenshots in `images/`).

## Step 2 — Platform manifest and provider (done)

Goal: a Here Core platform whose window shows six views and whose provider owns an Interop Broker.

- `public/manifest.fin.json`: runtime `stable`, provider URL, `defaultViewOptions.fdc3InteropApi = "2.0"`, layout (blotter + monitor on the left, four Deephaven embeds + the bridge host on the right), preload script on the bridge host view.
- `platform/provider.html` + `src/platform/provider.ts`: `fin.Platform.init({ interopOverride })` with a broker subclass that logs `setContext`.
- Verified: manifest is valid JSON and matches the `@openfin/core` v45 `Manifest`/`PlatformOptions`/`LayoutContent` types reviewed from the package; provider compiles against the `InteropBroker` typings. Launching inside Here Core is a **manual** step (below).

## Step 3 — Order blotter (done)

Goal: the FDC3 publisher.

- `blotter/index.html`, `src/blotter/main.ts`, `src/blotter/orders.ts`.
- Symbol input with datalist, Enter/Broadcast → `fdc3.broadcast(fdc3.instrument)`; own order grid filters to the symbol; row click re-broadcasts; order ticket adds working orders; a timer fills them so the grid looks alive; colour-channel picker; follows inbound instrument contexts.
- Verified: Playwright test "blotter broadcast reaches the monitor and filters the blotter".

## Step 4 — Interop monitor (done)

Goal: the Interop-API subscriber and a visible trace.

- `monitor/index.html`, `src/monitor/main.ts`; uses `fin.me.interop` inside Here Core, the shim elsewhere; logs every context with its JSON; quick-broadcast buttons; channel picker.
- Verified: Playwright tests "monitor quick-broadcast drives the blotter" and "colour channels isolate context".

## Step 5 — Deephaven bridge (done)

Goal: turn an FDC3 context into a Deephaven input-table write, from inside the Deephaven page.

- `public/preload/deephaven-bridge.js` (classic script): transport auto-detection (Interop API → `window.fdc3`), Deephaven JS API connection, variable lookup through `subscribeToFieldUpdates`, serialised `addRow` writes, viewport subscription for the round-trip badge, `window.__dhFdc3Bridge` debug surface.
- Verified three ways:
  1. Injected into the real Deephaven embed page with Playwright's `addInitScript` (the same "run before page scripts" mechanism as a preload). It connected, resolved `symbol_filter`, and `setSymbol('JPM')` was reflected by the server (`images/deephaven-preload-overlay.png`).
  2. Hosted by `bridge/index.html` in browser mode: the Playwright live test broadcasts from the blotter and then reads `quotes_filtered` through the JS API, asserting it contains only the broadcast symbol.
  3. Deephaven's CORS headers were checked (`Access-Control-Allow-Origin` echoes the origin) so browser mode works cross-origin.

## Step 6 — Browser mode and automated tests (done)

- `src/shared/fdc3-shim.ts`: minimal FDC3 2.0 Desktop Agent over `BroadcastChannel` (user channels, broadcast, listeners, late-join replay).
- `src/shared/fdc3.ts`: waits for the real `window.fdc3` / `fdc3Ready`, falls back to the shim.
- Unit tests (`tests/unit`, Vitest): instrument helpers and the shim. 15 tests.
- E2E tests (`tests/e2e`, Playwright): three browser-mode scenarios plus the live Deephaven round trip (enabled with `DEEPHAVEN_URL`). 4 tests.
- `npm run typecheck`, `npm run build` (Vite, five HTML entry points) pass.

## Step 7 — Documentation (done)

- `docs/README.md`, `docs/00-repo-structure-and-roadmap.md`, this plan, `01-technical-details.md`, `03-running-on-macos-and-windows.md`, screenshots under `images/`.

## Step 8 — Verification inside Here Core (manual, not yet done)

This repository was built and tested in a Linux container without the Here
Core runtime, so the following has **not** been exercised and is the first
thing to do on a Mac or Windows machine (see the run guide):

1. `npm run launch` opens the platform window with the six views laid out as in the manifest.
2. The blotter's badge reads "FDC3 2.0 · OpenFin" and the monitor's "Interop API · fin.me.interop".
3. Typing a symbol in the blotter updates the monitor log, the Deephaven quotes/trades/positions/chart views and the bridge badge in the `symbol_filter` view.
4. Clicking a different colour dot in the blotter stops the others from updating until they join the same colour.
5. The provider window log (open it from DevTools on port 9090, or set `platform.autoShow: true`) shows one `setContext` line per broadcast.

If any of these fail, the most likely places to look are listed in the
troubleshooting table of the technical-details document. Known unknowns:

- Here Core's exact behaviour when a preload script and `fdc3InteropApi` are both set on a view was reasoned from the API typings, not observed.
- Preload scripts are cached by the runtime; after editing the bridge, relaunch the platform.
