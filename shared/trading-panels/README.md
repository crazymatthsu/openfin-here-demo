# @openfin-here-demo/trading-panels

Panels and helpers shared by the demos. Each demo mounts them into its own
one-line entry pages, so a fix here lands in every demo.

| Export | What it is |
|--------|------------|
| `./blotter` → `mountBlotter(root)` | Order blotter, the FDC3 publisher (`fdc3.broadcast(fdc3.instrument)`) |
| `./monitor` → `mountMonitor(root)` | Interop monitor, subscribes with `fin.me.interop.addContextHandler` inside Here Core |
| `./bridge` → `mountBridgeHost(root)` | Browser-mode host page for the Deephaven bridge |
| `./preload/deephaven-bridge.js` | The preload script Here Core injects into a Deephaven view (classic script) |
| `./vite` → `tradingPanelsPreload()` | Vite plugin serving/emitting that script at `/preload/deephaven-bridge.js` |
| `./shared/fdc3`, `./shared/fdc3-shim` | `getFdc3()` (real `window.fdc3` or the BroadcastChannel shim) |
| `./shared/bus` | `ContextBus` façade over FDC3 and the Interop API |
| `./shared/instruments`, `./shared/channels`, `./shared/env`, `./shared/ui` | Instrument helpers, channel constants, runtime detection, small UI helpers |
| `./styles.css` | Shared dark trading-UI stylesheet |

```bash
npm run typecheck --workspace shared/trading-panels
npm test --workspace shared/trading-panels     # 15 Vitest cases: instruments + FDC3 shim
```
