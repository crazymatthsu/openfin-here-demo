# openfin-here-demo

Small, focused demos of **Here Core** (formerly OpenFin Container) features.
Each demo is an independent subproject under [`demos/`](./demos/README.md)
and is explained in [`docs/`](./docs/README.md).

| # | Demo | Shows |
|---|------|-------|
| 01 | [Interop API + FDC3 trading blotter](./demos/01-interop-fdc3-blotter/) | An equities order blotter broadcasts `fdc3.instrument`; an Interop-API monitor and four embedded **Deephaven** panels (tables + chart, filtered server-side) follow the symbol. A preload script makes the third-party Deephaven UI FDC3-aware without touching its code. |
| 02 | [Two windows on two screens](./demos/02-multi-window-multi-monitor/) | The same desk as two platform windows, placed on two monitors by the provider from `fin.System.getMonitorInfo()`. A Desk Controller moves, swaps and tiles windows, saves/restores layouts and re-channels every view. One Interop Broker keeps both windows in sync. |

## Quick start

```bash
npm install
# terminal 1 – Deephaven (shared)      npm run deephaven            (Docker; or shared/deephaven/start.sh | start.ps1)
# terminal 2 – web app                 npm run demo:01              (or npm run demo:02)
# terminal 3 – Here Core               npm run demo:01:launch       (or npm run demo:02:launch)
```

Then type a symbol in the Order Blotter. Full instructions, including macOS
and Windows specifics, are in
[docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md](./docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md)
and, for the two-screen set-up,
[docs/02-multi-window-multi-monitor/03-running-on-macos-and-windows.md](./docs/02-multi-window-multi-monitor/03-running-on-macos-and-windows.md).

## Documentation

- [How the repository is organised and what is planned](./docs/00-repo-structure-and-roadmap.md)
- [Demo 01 technical details](./docs/01-interop-fdc3-blotter/01-technical-details.md): platform, Interop Broker, FDC3 vs Interop API, preload scripts, Deephaven input tables and `where_in`, sequence diagram
- [Demo 01 implementation plan and status](./docs/01-interop-fdc3-blotter/02-implementation-plan.md)
- [Demo 01 run guide for macOS and Windows](./docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md)
- [Demo 02 technical details](./docs/02-multi-window-multi-monitor/01-technical-details.md): two windows, one broker, monitor placement, Desk Controller, snapshots
- [Demo 02 implementation plan and status](./docs/02-multi-window-multi-monitor/02-implementation-plan.md)
- [Demo 02 run guide for two screens on macOS and Windows](./docs/02-multi-window-multi-monitor/03-running-on-macos-and-windows.md)
- Shared code: [`shared/trading-panels`](./shared/trading-panels/README.md) (panels, FDC3 shim, preload) and [`shared/deephaven`](./shared/deephaven/README.md) (tables)

## Repository scripts

```bash
npm run build        # build every demo
npm run typecheck    # tsc --noEmit in every demo
npm test             # unit tests in every demo
```

## License

MIT, see [LICENSE](./LICENSE). Here Core / OpenFin and Deephaven are subject to their own licenses.
