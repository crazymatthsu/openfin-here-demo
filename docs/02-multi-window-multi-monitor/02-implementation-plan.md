# Demo 02 · Implementation plan and status

Status legend: **done** = implemented and verified in this repository;
**manual** = needs a machine with Here Core and two monitors.

## Step 0 — Share what demo 01 built (done)

Demo 02 needs the same blotter, monitor, Deephaven bridge and Deephaven
tables as demo 01, so those moved out of demo 01 into two shared folders:

- `shared/trading-panels/` — an npm workspace (`@openfin-here-demo/trading-panels`) exporting `mountBlotter()`, `mountMonitor()`, `mountBridgeHost()`, the FDC3 resolver and shim, the context bus, instrument helpers, UI helpers and the stylesheet, plus the preload script and a tiny Vite plugin (`tradingPanelsPreload()`) that serves/emits it at `/preload/deephaven-bridge.js`. Its unit tests moved with it.
- `shared/deephaven/` — the Deephaven script, app-mode descriptor, embedded-server runner, Docker Compose and start scripts, unchanged.

Demo 01 now consists of its manifest, provider, four one-line entry pages
and its e2e tests. Verified: demo 01 typecheck, build and all 4 Playwright
tests (including the live Deephaven round trip) pass on the new layout; the
shared package's 15 unit tests pass.

## Step 1 — Two-window manifest (done)

`public/manifest.fin.json`: platform uuid `openfin-here-demo.multi-window-multi-monitor`,
dev server on port 5174, DevTools on 9091, two windows in the snapshot:

- `trading-desk` (`customData.screen = "primary"`, tile left): blotter 58 % | Desk Controller / Interop Monitor.
- `market-data` (`customData.screen = "secondary"`, tile right): Deephaven quotes | chart / trades | positions | `symbol_filter` with the bridge preload.

Both windows set `saveWindowState: false` so the screen hint wins on every launch.

## Step 2 — Placement maths (done)

`src/platform/placement.ts`: `listScreens` (left-to-right numbering),
`pickScreen` (primary / secondary / N with fallback), `boundsOn` (full, left
or right half of `availableRect` minus a margin), `placeWindow` (hint →
bounds, tiling on a single screen), `readScreenHint`, `screenOf` (which
screen a window is on), `describeScreen`.

Verified: 14 Vitest cases covering single, dual, left-of-primary and triple
monitors, negative coordinates, mixed scale factors and malformed hints.

## Step 3 — Provider with placement override (done)

`src/platform/provider.ts`: `overrideCallback` subclasses the Platform
Provider and rewrites `defaultLeft/Top/Width/Height` in `createWindow()`
from the hint; `interopOverride` logs every `setContext` as in demo 01.
Verified by typecheck against the `@openfin/core` v45 typings; runtime
behaviour is a manual step (below).

## Step 4 — Desk Controller (done)

`src/desk/main.ts`: screens table, windows table with per-screen move
buttons, Swap, Tile on primary, Save/Restore/Reset layout, Re-open closed
window, desk-wide channel buttons, instrument sync status, event log;
browser-mode notice when `fin` is absent.

Verified with Playwright against a mocked `fin` (`tests/e2e/fin-mock.ts`,
two or one monitors): 9 tests covering listing, move, swap, tile, desk
channel (8 `joinContextGroup` calls with view identities), save/restore
(`autoPlace: false`, `closeExistingWindows: true`), re-open from manifest,
cross-page instrument sync via the FDC3 shim, and the browser-mode notice.

## Step 5 — Docs (done)

This folder: technical details with sequence diagram, this plan, the run
guide; screenshots under `images/`. Shared docs updated for the new layout.

## Step 6 — Verification inside Here Core (manual, not yet done)

On a Mac or Windows machine with two monitors, after following the run guide:

1. `npm run demo:02:launch` opens **two** platform windows: `trading-desk` on the primary screen, `market-data` on the second. Disconnect the second screen and relaunch: both windows tile side by side on the primary.
2. The Desk Controller lists both screens with their DIP sizes and scale factors, and both windows with the screen each is on. The provider log (DevTools on port 9091, or set `platform.autoShow: true`) shows one "place … on Screen N" line per window.
3. Type a symbol in the blotter (screen 1): the Deephaven panels (screen 2) and the monitor follow; the bridge badge in `symbol_filter` reads `server filter: <symbol>`.
4. "Move to Screen 1" on `market-data` moves it; "Swap screens" exchanges them; "Tile on primary" puts both on the primary.
5. Click a desk-channel colour: the blotter's and monitor's channel dots change in both windows; broadcast again and everything still follows. Then click a *different* colour in the blotter's own picker: the Deephaven panels stop following until the desk channel is re-applied.
6. Move the windows by hand, "Save layout", "Reset to manifest" (windows return to their screens), "Restore layout" (windows return to where you put them).
7. Close `market-data`; the Desk Controller shows it as closed; "Re-open from manifest" brings it back on screen 2.

Known unknowns:

- Whether `createWindow()` in the provider override is invoked with the manifest's window definition during `Platform.init()` was reasoned from the API documentation; if the two windows ignore the hints, move the placement into an `applySnapshot` override or call `setBounds()` after `init()` resolves.
- `getChildWindows()` may include internal windows on some runtime versions; the Desk Controller lists whatever it returns and marks the two desk windows by `customData.role`.
