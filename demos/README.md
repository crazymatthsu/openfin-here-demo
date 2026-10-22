# Demo catalog

Each folder here is a self-contained subproject that demonstrates one Here Core
(OpenFin) capability. Every demo has its own `package.json`, its own README,
and its own entry in [`../docs`](../docs/README.md).

| # | Folder | Feature under demonstration | Status |
|---|--------|-----------------------------|--------|
| 01 | [`01-interop-fdc3-blotter`](./01-interop-fdc3-blotter/) | Interop API + FDC3 context sharing. An equities order blotter broadcasts `fdc3.instrument`; embedded Deephaven panels and a native monitor panel follow the selected symbol. | Implemented |
| 02 | [`02-multi-window-multi-monitor`](./02-multi-window-multi-monitor/) | The same desk split into two platform windows placed on two screens by the provider (`fin.System.getMonitorInfo`, `createWindow` override); a Desk Controller moves/swaps/tiles windows, saves layouts and re-channels every view. Sync across windows comes from the shared Interop Broker. | Implemented |
| 03 | _planned_ | Intents (`raiseIntent`, intent resolution, app directory) | Not started |
| 04 | _planned_ | Platform API customisation (custom window frame, snapshots, layouts) | Not started |
| 05 | _planned_ | Notifications and Home / Store (Here Workspace) | Not started |
| 06 | _planned_ | Channel API and App-to-App messaging | Not started |

## Adding a new demo

1. Copy the structure of `02-multi-window-multi-monitor` (Vite + TypeScript, `public/manifest.fin.json`, one-line entry pages that mount panels from `shared/trading-panels`).
2. Give it a unique `platform.uuid` in the manifest and a unique dev-server port (01 = 5173, 02 = 5174).
3. Add a row to the table above and a folder under `docs/`.
4. Register nothing else: the root `package.json` picks up every `demos/*` workspace automatically. Deephaven is shared: `shared/deephaven`.
