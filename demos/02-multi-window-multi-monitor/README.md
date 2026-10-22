# Demo 02 · Two windows on two screens, one Interop Broker

Demo 01's desk split into **two platform windows** so each can sit on its
own monitor: `trading-desk` (blotter, Desk Controller, monitor) on the
primary screen and `market-data` (the Deephaven panels) on the secondary.
Both belong to one platform and therefore share one Interop Broker, so a
symbol picked on screen 1 drives the Deephaven panels on screen 2 with no
extra code. The provider places each window from a `customData.screen` hint
using `fin.System.getMonitorInfo()`, and a new **Desk Controller** panel
lists screens and windows, moves/swaps/tiles them, saves and restores
layouts, and re-channels every view in every window.

Documentation: [`../../docs/02-multi-window-multi-monitor/`](../../docs/02-multi-window-multi-monitor/)

- [Technical details](../../docs/02-multi-window-multi-monitor/01-technical-details.md)
- [Implementation plan and status](../../docs/02-multi-window-multi-monitor/02-implementation-plan.md)
- [Running on macOS and Windows with two screens](../../docs/02-multi-window-multi-monitor/03-running-on-macos-and-windows.md)

## Run

```bash
npm run deephaven          # repo root: shared Deephaven (or shared/deephaven/start.sh / start.ps1)
npm run demo:02            # Vite on http://localhost:5174
npm run demo:02:launch     # openfin --launch --config http://localhost:5174/manifest.fin.json
```

## Layout of this folder

| Path | Purpose |
|------|---------|
| `public/manifest.fin.json` | Platform manifest with two windows and per-window screen hints |
| `platform/`, `src/platform/provider.ts` | Provider: `createWindow` placement override + Interop Broker logging |
| `src/platform/placement.ts` | Pure monitor/placement maths (unit-tested) |
| `desk/`, `src/desk/main.ts` | Desk Controller panel |
| `blotter/`, `monitor/`, `bridge/` + `src/*.ts` | One-line entry pages for the shared panels |
| `tests/unit` | Placement tests (Vitest) |
| `tests/e2e` | Desk Controller tests against a mocked `fin` API (Playwright) |

The blotter, monitor and Deephaven bridge come from
[`shared/trading-panels`](../../shared/trading-panels/); the Deephaven
tables from [`shared/deephaven`](../../shared/deephaven/).
