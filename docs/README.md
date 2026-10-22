# Documentation

This folder explains every demo in the repository: what it shows, how the
technology works underneath, the plan that was followed to build it, and how to
run it on macOS and Windows.

| Document | What it covers |
|----------|----------------|
| [00 · Repository structure and roadmap](./00-repo-structure-and-roadmap.md) | How the monorepo is organised, how to add a demo, which demos are planned. |
| [01 · Interop API + FDC3 trading blotter — technical details](./01-interop-fdc3-blotter/01-technical-details.md) | Here Core platform, Interop Broker, FDC3 vs Interop API, preload scripts, Deephaven input tables and `where_in`, the full message flow. |
| [01 · Implementation plan](./01-interop-fdc3-blotter/02-implementation-plan.md) | The step-by-step plan, what each step produced, how it was verified, what is still open. |
| [01 · Running on macOS and Windows](./01-interop-fdc3-blotter/03-running-on-macos-and-windows.md) | Prerequisites, start-up commands, OS-specific notes, troubleshooting. |
| [02 · Two windows on two screens — technical details](./02-multi-window-multi-monitor/01-technical-details.md) | Why one platform keeps two windows in sync, `fin.System.getMonitorInfo()`, the `createWindow` placement override, the Desk Controller, snapshots, desk-wide channels. |
| [02 · Implementation plan](./02-multi-window-multi-monitor/02-implementation-plan.md) | The shared-package refactor, the steps, what was verified, what is manual. |
| [02 · Running on macOS and Windows](./02-multi-window-multi-monitor/03-running-on-macos-and-windows.md) | Display arrangement on each OS, launch, what to try, troubleshooting. |

Vocabulary used throughout:

- **Here Core** is the current name of the OpenFin Container runtime. The JavaScript API is still the `fin` object and the npm packages are still `@openfin/*`, so this documentation uses "Here Core" for the product and "OpenFin" for the API.
- **Platform** is a Here Core application started from a *platform manifest*. It owns windows that host *views* (Chromium browser views) arranged in a *layout*.
- **Interop Broker** is the hub created by the platform through which context (data such as "the selected instrument") and intents flow.
- **FDC3** is the FINOS standard API for desktop interoperability. In Here Core it is implemented on top of the Interop Broker.
- **Deephaven** is the real-time data engine whose web UI is embedded in the demo.
