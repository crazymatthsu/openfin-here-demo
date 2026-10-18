# openfin-here-demo

Small, focused demos of **Here Core** (formerly OpenFin Container) features.
Each demo is an independent subproject under [`demos/`](./demos/README.md)
and is explained in [`docs/`](./docs/README.md).

| # | Demo | Shows |
|---|------|-------|
| 01 | [Interop API + FDC3 trading blotter](./demos/01-interop-fdc3-blotter/) | An equities order blotter broadcasts `fdc3.instrument`; an Interop-API monitor and four embedded **Deephaven** panels (tables + chart, filtered server-side) follow the symbol. A preload script makes the third-party Deephaven UI FDC3-aware without touching its code. |

## Quick start (demo 01)

```bash
npm install
# terminal 1 – Deephaven (Docker)      cd demos/01-interop-fdc3-blotter/deephaven && docker compose up
#              or without Docker       ./start.sh   (macOS)   /   .\start.ps1   (Windows)
# terminal 2 – web app                 npm run demo:01
# terminal 3 – Here Core               npm run demo:01:launch
```

Then type a symbol in the Order Blotter. Full instructions, including macOS
and Windows specifics, are in
[docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md](./docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md).

## Documentation

- [How the repository is organised and what is planned](./docs/00-repo-structure-and-roadmap.md)
- [Demo 01 technical details](./docs/01-interop-fdc3-blotter/01-technical-details.md): platform, Interop Broker, FDC3 vs Interop API, preload scripts, Deephaven input tables and `where_in`, sequence diagram
- [Demo 01 implementation plan and status](./docs/01-interop-fdc3-blotter/02-implementation-plan.md)
- [Demo 01 run guide for macOS and Windows](./docs/01-interop-fdc3-blotter/03-running-on-macos-and-windows.md)

## Repository scripts

```bash
npm run build        # build every demo
npm run typecheck    # tsc --noEmit in every demo
npm test             # unit tests in every demo
```

## License

MIT, see [LICENSE](./LICENSE). Here Core / OpenFin and Deephaven are subject to their own licenses.
