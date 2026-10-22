# Repository structure and roadmap

## Layout

```
openfin-here-demo/
├── package.json              npm workspaces root ("demos/*"); aggregates build/test/typecheck
├── README.md                 entry point
├── docs/                     all documentation (this folder)
│   ├── README.md
│   ├── 00-repo-structure-and-roadmap.md
│   ├── 01-interop-fdc3-blotter/      technical details, plan, run guide, images/
│   └── 02-multi-window-multi-monitor/ technical details, plan, run guide, images/
├── shared/
│   ├── trading-panels/       npm workspace @openfin-here-demo/trading-panels, used by every demo
│   │   ├── src/blotter/      order blotter (FDC3 publisher)          → mountBlotter()
│   │   ├── src/monitor/      interop monitor (Interop API subscriber) → mountMonitor()
│   │   ├── src/bridge/       browser-mode host for the preload        → mountBridgeHost()
│   │   ├── src/shared/       FDC3 access + browser shim, context bus, instruments, env, UI helpers
│   │   ├── src/styles.css    shared stylesheet
│   │   ├── preload/deephaven-bridge.js   preload script injected into a Deephaven view
│   │   ├── vite-plugin.mjs   tradingPanelsPreload(): serves/emits the preload at /preload/…
│   │   └── tests/unit/       Vitest: instruments, FDC3 shim
│   └── deephaven/            Deephaven side shared by all demos: app.d/ script, run_server.py,
│                             docker-compose.yml, start.sh / start.ps1
└── demos/
    ├── README.md             catalog of demos
    ├── 01-interop-fdc3-blotter/           port 5173
    │   ├── public/manifest.fin.json       platform manifest: one window, six views
    │   ├── platform/ + src/platform/      provider (Interop Broker + logging override)
    │   ├── blotter/ monitor/ bridge/      one-line entry pages + src/*.ts mounting the shared panels
    │   └── tests/e2e/                     Playwright browser-mode + live Deephaven tests
    └── 02-multi-window-multi-monitor/     port 5174
        ├── public/manifest.fin.json       platform manifest: two windows with screen hints
        ├── platform/ + src/platform/      provider with createWindow placement override; placement.ts
        ├── desk/ + src/desk/              Desk Controller panel
        ├── blotter/ monitor/ bridge/      entry pages for the shared panels
        └── tests/                         Vitest (placement) + Playwright (Desk Controller with a fin mock)
```

## Conventions

- **One feature per demo.** A demo should be understandable in an afternoon. If a second feature creeps in, it becomes demo *N+1* and the two link to each other.
- **Each demo is an npm workspace** (`demos/*`), and so is the shared panels package (`shared/trading-panels`). `npm install` at the root installs and links everything; `npm run build`, `npm run test` and `npm run typecheck` at the root fan out to all workspaces.
- **Shared code lives in `shared/`.** Panels that several demos show (blotter, monitor, Deephaven bridge) are mounted from `@openfin-here-demo/trading-panels`; each demo keeps only its manifest, provider, entry pages and anything unique to it. The Deephaven tables are in `shared/deephaven` and every demo points at the same server.
- **Absolute localhost URLs in manifests.** Here Core fetches the manifest and every page by URL, so each demo pins its dev-server port (demo 01 uses 5173) and references it in `manifest.fin.json`.
- **Runs without the runtime too.** Every demo should degrade to a plain browser (reduced fidelity) so it can be developed and tested without Here Core. Demo 01 does this with a small FDC3 shim.
- **Docs live in `docs/`, not inside the demo.** The demo folder has a short README that points to `docs/`.

## Adding a demo

1. `cp -r demos/02-multi-window-multi-monitor demos/03-<feature>` and strip what you do not need.
2. Change `name` in `package.json`, the dev-server port in `vite.config.ts`, and `platform.uuid` plus all URLs in `public/manifest.fin.json`.
3. Put anything reusable into `shared/trading-panels`; keep demo-specific panels in the demo.
4. Add the row to `demos/README.md`, the `demo:NN` scripts to the root `package.json`, and a folder under `docs/`.

## Roadmap

| # | Feature under demonstration | Idea |
|---|-----------------------------|------|
| 01 | Interop API + FDC3 context sharing | **Done.** Order blotter broadcasts `fdc3.instrument`; Deephaven panels and a monitor follow. |
| 02 | Multi-window, multi-monitor platform | **Done.** Two platform windows placed on two screens by a `createWindow` override; Desk Controller for windows, layouts and desk-wide channels; one broker keeps them in sync. |
| 03 | FDC3 intents | Blotter raises `ViewChart` / `ViewNews`; the platform's broker override resolves the intent to a Deephaven chart view or opens a new view. Needs an app directory. |
| 04 | Platform API customisation | Custom window frame (title bar with the channel picker), `Platform.createView`, layout manipulation, tear-outs. |
| 05 | Here Workspace (Home, Store, Dock, Notifications) | Register the panels as Workspace apps; raise notifications on fills. |
| 06 | Channel API and app-to-app RPC | A pricing service window answering `getQuote` requests from the blotter via `fin.InterApplicationBus.Channel`. |
| 07 | Two platforms, bridged brokers | Run trading-desk and market-data as separate platforms and connect their Interop Brokers. |
| 08 | Deephaven → OpenFin direction | Subscribe to a Deephaven table of alerts and broadcast FDC3 contexts *from* Deephaven into the platform. |
