# Demo 01 · Running on macOS and Windows

The demo has three moving parts, started in this order:

1. **Deephaven** (data + embedded panels) on `http://localhost:10000`
2. **The web app dev server** (blotter, monitor, provider, manifest, preload) on `http://localhost:5173`
3. **Here Core / OpenFin** launched with the manifest URL

Everything below assumes you cloned the repository and are in its root.

## Prerequisites

| Requirement | macOS | Windows | Notes |
|-------------|-------|---------|-------|
| Node.js 22 LTS (≥ 20.19) | `brew install node@22` or nodejs.org installer | nodejs.org installer or `winget install OpenJS.NodeJS.LTS` | Vite 8 needs a recent Node. |
| Deephaven, **either** Docker Desktop | docker.com | docker.com (WSL 2 backend) | Simplest; uses `shared/deephaven/docker-compose.yml`. |
| **or** Python 3.10–3.13 + Java 17+ | `brew install python@3.12 temurin@21` | `winget install Python.Python.3.12 EclipseAdoptium.Temurin.21.JDK` | `pip install deephaven-server` path; needs `java` on `PATH` or `JAVA_HOME`. |
| Here Core / OpenFin runtime | downloaded automatically by `openfin-cli` on first launch | downloaded automatically by the OpenFin RVM on first launch | Needs outbound HTTPS to `cdn.openfin.co`. |

Here Core on macOS is published by Here for development and experimentation
(macOS 13+, Intel and Apple Silicon); production use on macOS is a
conversation with Here. Windows is the primary production platform.

## 1. Install the JavaScript dependencies (both OSes)

```bash
npm install
```

## 2. Start Deephaven

### Option A — Docker (both OSes)

```bash
npm run deephaven                 # = cd shared/deephaven && docker compose up
```

The compose file (in `shared/deephaven/`) mounts `app.d/` into the container, enables *application
mode* so `fdc3_blotter.py` runs at start-up, and sets anonymous
authentication. First start pulls the image (about 1 GB).

### Option B — pip, no Docker

macOS / Linux:

```bash
cd shared/deephaven
./start.sh                 # creates .venv, installs deephaven-server, runs run_server.py
```

Windows (PowerShell):

```powershell
cd shared\deephaven
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass   # only if scripts are blocked
.\start.ps1
```

Or by hand on either OS:

```bash
python -m venv .venv
# macOS: source .venv/bin/activate      Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_server.py --port 10000
```

### Check

Open <http://localhost:10000/ide/>. The **Panels** menu (top right) must list
`symbol_filter`, `quotes_filtered`, `trades_filtered`, `positions_filtered`
and `price_chart`. Open `quotes_filtered`: it ticks and shows only `AAPL`
(the seeded filter value).

## 3. Start the web app

In a second terminal, from the repository root:

```bash
npm run demo:01            # = npm run dev in demos/01-interop-fdc3-blotter (Vite on port 5173)
```

Check <http://localhost:5173/> loads the landing page and
<http://localhost:5173/manifest.fin.json> returns the manifest. The port is
pinned (`strictPort`); if 5173 is taken, stop whatever holds it, because the
manifest refers to it by absolute URL.

## 4. Launch inside Here Core

In a third terminal:

```bash
npm run demo:01:launch     # = openfin --launch --config http://localhost:5173/manifest.fin.json
```

What happens:

- **macOS:** `openfin-cli` resolves `"stable"` to a concrete runtime version, downloads the runtime from `cdn.openfin.co` into `~/OpenFin/Runtime/<version>/` on first run (tens of MB, a minute or two), then starts `OpenFin.app` with the manifest. The adapter downloads the x64 build; on Apple Silicon macOS runs it through Rosetta 2 (install it when prompted, or `softwareupdate --install-rosetta`). Gatekeeper may ask you to confirm opening the downloaded app the first time.
- **Windows:** `openfin-cli` starts the **OpenFin RVM** (`%LOCALAPPDATA%\OpenFin\OpenFinRVM.exe`, installed on first use), which downloads the runtime into `%LOCALAPPDATA%\OpenFin\runtime\` and launches the platform. Windows Defender SmartScreen may ask once.

Alternative without the CLI: if the Here Core / OpenFin RVM is already
installed, open `fins://localhost:5173/manifest.fin.json` from the landing
page or paste it into the browser's address bar.

A platform window opens with the layout:

```
┌────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Order Blotter          │ Deephaven · Quotes      │ Deephaven · Price chart │
│ (FDC3 publisher)       │ (filtered)              │ (filtered)              │
│                        ├───────────┬─────────────┼─────────────────────────┤
├────────────────────────┤ Deephaven │ Deephaven   │ Deephaven · symbol_filter│
│ Interop Monitor        │ · Trades  │ · Positions │ (bridge host, shows the │
│ (Interop API)          │           │             │  FDC3 bridge badge)     │
└────────────────────────┴───────────┴─────────────┴─────────────────────────┘
```

## 5. Drive the demo

1. In **Order Blotter** type `NVDA` and press Enter (or click any order row, or pick from the drop-down).
2. Watch: the blotter grid filters; **Interop Monitor** logs `received fdc3.instrument NVDA`; the four Deephaven panels switch to NVDA; the badge in the `symbol_filter` view reads `server filter: NVDA`.
3. Click a different colour dot in the blotter header. Broadcast `AAPL`: nothing else changes (other panels are still on green). Click the same colour in the monitor: it follows again. The Deephaven bridge stays on green unless you move it (`window.__dhFdc3Bridge.setChannel('red')` from the view's DevTools).
4. Use the monitor's quick-broadcast buttons: they call `fin.me.interop.setContext()` directly and the blotter follows, showing the two APIs are symmetric.
5. Open DevTools for any view: <http://localhost:9090> lists the pages (the manifest sets `devtools_port: 9090`).

## 6. Browser mode (no Here Core)

Useful on a locked-down machine or for quick UI work. Fidelity is reduced:
contexts travel over a `BroadcastChannel` shim instead of the Interop Broker,
and the Deephaven bridge runs in a page of ours instead of a preload script.

1. Steps 2 and 3 as above.
2. Open <http://localhost:5173/> and use the three "browser mode" links to open the blotter, monitor and bridge in separate tabs, plus any of the Deephaven embed links.
3. Type a symbol in the blotter: the monitor, the bridge page and the Deephaven tabs all follow.

## 7. Tests

```bash
npm run typecheck                          # every workspace
npm test                                   # unit tests (shared panels + demo 02 placement)
cd demos/01-interop-fdc3-blotter
npx playwright install chromium            # once
npm run test:e2e                           # browser-mode e2e
DEEPHAVEN_URL=http://localhost:10000 npm run test:e2e     # adds the live Deephaven round trip
```

On Windows PowerShell set the variable first: `$env:DEEPHAVEN_URL="http://localhost:10000"; npm run test:e2e`.

## 8. Stopping and cleaning up

- Close the platform window; `openfin-cli` exits when the platform disconnects.
- `Ctrl+C` in the Vite and Deephaven terminals (`docker compose down` for Docker).
- Runtime downloads live in `~/OpenFin/Runtime` (macOS) or `%LOCALAPPDATA%\OpenFin` (Windows) and can be deleted.

## 9. Troubleshooting

| Problem | What to check |
|---------|---------------|
| `openfin` command not found | Run from the repository root with `npm run demo:01:launch`, or `npx openfin ...` inside the demo folder. |
| Launch hangs at "Launching OpenFin" | First-run download of the runtime; check connectivity to `cdn.openfin.co`. Corporate proxies: set `HTTPS_PROXY`. |
| macOS: "OpenFin.app can't be opened" | System Settings → Privacy & Security → Open Anyway (first launch only). |
| Windows: platform opens but views are blank | Windows Firewall prompt for Node (Vite) or Java (Deephaven) was dismissed; allow them on private networks. |
| Deephaven views show a login page | Server not started with anonymous auth; use the provided compose file / `run_server.py`. |
| `java` not found when using pip | Install Temurin 17 or 21 and reopen the terminal; on Windows check `JAVA_HOME`. |
| Deephaven fails to start with an out-of-memory error | Lower the heap: `python run_server.py --heap 2g` or edit `START_OPTS` in the compose file. |
| Port 10000 or 5173 already in use | Stop the other process; both ports are hard-coded in `manifest.fin.json`. To change them, edit the manifest URLs and `vite.config.ts`. |
| Bridge badge shows an error | Open the view's DevTools (port 9090) and read the `[dh-fdc3-bridge]` log lines; `window.__dhFdc3Bridge.getState()` prints the state. |
