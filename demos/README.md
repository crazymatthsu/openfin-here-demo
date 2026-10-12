# Demo catalog

Each folder here is a self-contained subproject that demonstrates one Here Core
(OpenFin) capability. Every demo has its own `package.json`, its own README,
and its own entry in [`../docs`](../docs/README.md).

| # | Folder | Feature under demonstration | Status |
|---|--------|-----------------------------|--------|
| 01 | [`01-interop-fdc3-blotter`](./01-interop-fdc3-blotter/) | Interop API + FDC3 context sharing. An equities order blotter broadcasts `fdc3.instrument`; embedded Deephaven panels and a native monitor panel follow the selected symbol. | Implemented |
| 02 | _planned_ | Intents (`raiseIntent`, intent resolution, app directory) | Not started |
| 03 | _planned_ | Platform API customisation (custom window frame, snapshots, layouts) | Not started |
| 04 | _planned_ | Notifications and Home / Store (Here Workspace) | Not started |
| 05 | _planned_ | Channel API and App-to-App messaging | Not started |

## Adding a new demo

1. Copy the structure of `01-interop-fdc3-blotter` (Vite + TypeScript, `public/manifest.fin.json`).
2. Give it a unique `platform.uuid` in the manifest and a unique dev-server port.
3. Add a row to the table above and a page under `docs/`.
4. Register nothing else: the root `package.json` picks up every `demos/*` workspace automatically.
