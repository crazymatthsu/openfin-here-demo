# Repository structure and roadmap

## Layout

```
openfin-here-demo/
├── package.json              npm workspaces root ("demos/*"); aggregates build/test/typecheck
├── README.md                 entry point
├── docs/                     all documentation (this folder)
│   ├── README.md
│   ├── 00-repo-structure-and-roadmap.md
│   └── 01-interop-fdc3-blotter/
│       ├── 01-technical-details.md
│       ├── 02-implementation-plan.md
│       ├── 03-running-on-macos-and-windows.md
│       └── images/
└── demos/
    ├── README.md             catalog of demos
    └── 01-interop-fdc3-blotter/
        ├── package.json      Vite + TypeScript subproject
        ├── public/
        │   ├── manifest.fin.json           Here Core platform manifest (runtime, provider, layout)
        │   └── preload/deephaven-bridge.js preload script injected into the Deephaven view
        ├── index.html        landing page (links, launch instructions)
        ├── platform/provider.html   + src/platform/provider.ts   platform provider (creates the Interop Broker)
        ├── blotter/index.html       + src/blotter/*.ts           order blotter (FDC3 publisher)
        ├── monitor/index.html       + src/monitor/main.ts        interop monitor (Interop API subscriber)
        ├── bridge/index.html        + src/bridge/main.ts         browser-mode host for the preload script
        ├── src/shared/       FDC3 access + browser shim, context bus, instruments, UI helpers, styles
        ├── deephaven/        Deephaven side: app.d/ script, run_server.py, docker-compose.yml, start scripts
        └── tests/            unit (Vitest) and e2e (Playwright) tests
```

## Conventions

- **One feature per demo.** A demo should be understandable in an afternoon. If a second feature creeps in, it becomes demo *N+1* and the two link to each other.
- **Each demo is an npm workspace** (`demos/*`). `npm install` at the root installs everything; `npm run build`, `npm run test` and `npm run typecheck` at the root fan out to all demos.
- **Absolute localhost URLs in manifests.** Here Core fetches the manifest and every page by URL, so each demo pins its dev-server port (demo 01 uses 5173) and references it in `manifest.fin.json`.
- **Runs without the runtime too.** Every demo should degrade to a plain browser (reduced fidelity) so it can be developed and tested without Here Core. Demo 01 does this with a small FDC3 shim.
- **Docs live in `docs/`, not inside the demo.** The demo folder has a short README that points to `docs/`.

## Adding a demo

1. `cp -r demos/01-interop-fdc3-blotter demos/02-<feature>` and strip what you do not need.
2. Change `name` in `package.json`, the dev-server port in `vite.config.ts`, and `platform.uuid` plus all URLs in `public/manifest.fin.json`.
3. Add the row to `demos/README.md` and a folder under `docs/`.

## Roadmap

| # | Feature under demonstration | Idea |
|---|-----------------------------|------|
| 01 | Interop API + FDC3 context sharing | **Done.** Order blotter broadcasts `fdc3.instrument`; Deephaven panels and a monitor follow. |
| 02 | FDC3 intents | Blotter raises `ViewChart` / `ViewNews`; the platform's broker override resolves the intent to a Deephaven chart view or opens a new view. Needs an app directory. |
| 03 | Platform API customisation | Custom window frame (title bar with the channel picker), save/restore snapshots, `Platform.createView`, layout manipulation. |
| 04 | Here Workspace (Home, Store, Dock, Notifications) | Register the blotter as a Workspace app; raise notifications on fills. |
| 05 | Channel API and app-to-app RPC | A pricing service window answering `getQuote` requests from the blotter via `fin.InterApplicationBus.Channel`. |
| 06 | Deephaven → OpenFin direction | Subscribe to a Deephaven table of alerts and broadcast FDC3 contexts *from* Deephaven into the platform. |
