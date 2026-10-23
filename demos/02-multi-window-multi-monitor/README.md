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

### From scratch, three terminals

The tiers must start in this order, each from the repository root.

```bash
# 1. Deephaven — shared with demo 01
npm run deephaven                                  # Docker
cd shared/deephaven && podman-compose up            # or podman, if you have no Docker

# 2. Vite on 5174
npm run demo:02

# 3. Platform — step 2 must be serving before this runs
npm run demo:02:launch
# or, if openfin-cli fails with "EPERM: chmod", launch the runtime directly:
"$(ls -d ~/OpenFin/Runtime/*/OpenFin.app | sort -V | tail -1)/Contents/MacOS/OpenFin" \
  --startup-url=http://localhost:5174/manifest.fin.json --version-keyword=stable
```

On Windows replace the runtime path with
`%LOCALAPPDATA%\OpenFin\runtime\<version>\OpenFin.exe`, or just use
`npm run demo:02:launch`, which works there.

Notes on the alternatives above:

- **podman instead of Docker** — `npm run deephaven` is `docker compose up`, so
  it needs a `docker` binary. The `ghcr.io/deephaven/server-ui` image has a
  native `linux/arm64` manifest and runs under podman without emulation.
- **`EPERM: chmod` on launch** — `openfin-cli` calls `chmod` on the runtime
  binary before launching, which macOS App Management protection denies once
  `OpenFin.app` has been launched and registered by the system. This hits the
  *second* launch on a given machine, not the first. The exec bit is already
  set by then, so launching the binary directly skips a redundant `chmod`. The
  `ls | sort -V | tail -1` picks the newest installed runtime; unlike the CLI it
  will not download a newer `"stable"` build.
- **Step 2 before step 3** — the port is pinned (`strictPort`) and
  `manifest.fin.json` refers to `http://localhost:5174` by absolute URL, so
  launching first fails with `ECONNREFUSED 127.0.0.1:5174`.
- **Node not on `PATH`** — if `npm` is not found, prefix the commands with an
  export such as `export PATH="$HOME/.local/node-v22/bin:$PATH"`.

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
