# Demo 02 · Running on macOS and Windows (two screens)

Demo 02 reuses demo 01's Deephaven server and shares its panels, so the
set-up is the same except for the port and the launch command. If you have
not run demo 01 yet, read its
[run guide](../01-interop-fdc3-blotter/03-running-on-macos-and-windows.md)
for prerequisites (Node 22, Docker or Python + Java) and first-run notes
(runtime download, Gatekeeper, SmartScreen).

## 1. Start Deephaven (shared by all demos)

```bash
npm run deephaven                      # = cd shared/deephaven && docker compose up
# or without Docker:
cd shared/deephaven && ./start.sh      # macOS / Linux
cd shared\deephaven; .\start.ps1       # Windows PowerShell
```

Check <http://localhost:10000/ide/> lists `symbol_filter`, `quotes_filtered`, …

## 2. Start the demo 02 web app

```bash
npm install
npm run demo:02                        # Vite on http://localhost:5174 (demo 01 uses 5173; both can run)
```

## 3. Launch inside Here Core

```bash
npm run demo:02:launch                 # = openfin --launch --config http://localhost:5174/manifest.fin.json
```

or open `fins://localhost:5174/manifest.fin.json` if the RVM is installed.

Two windows open: **trading-desk** on your primary display and
**market-data** on the display to its right (or any other secondary display).
With a single display they tile left/right.

## 4. Arrange your displays first

The demo reads the display layout from the OS through `fin.System.getMonitorInfo()`.
"Secondary" means the first display whose left edge is to the right of the
primary's; if there is none, any other display.

### macOS

- **System Settings → Displays**: with two displays, click *Arrange…* and drag the second display to the right of the one with the white menu bar (the primary). The menu bar's display is what the demo calls Screen 1.
- **Mirroring** must be off (*Use as: Extended display*).
- **System Settings → Desktop & Dock → Mission Control → "Displays have separate Spaces"**: leave it on (default). With it off, the menu bar exists on one display only and `availableRect` differs; the demo still works, bounds just differ by the menu bar height.
- Retina vs. non-Retina pairs are fine: coordinates are DIP, the Desk Controller shows the scale per screen.

### Windows

- **Settings → System → Display**: select *Extend these displays*; drag display 2 to the right of display 1 (the one marked *Make this my main display*).
- Per-monitor DPI scaling (for example 100 % on a 4K monitor set to 150 %) is handled by Chromium; the Desk Controller shows the scale.
- Windows numbers displays by connection order; the demo numbers them left to right, so "Screen 2" in the demo may be "Display 1" in Settings.

## 5. Drive the demo

1. In the blotter (screen 1) pick `NVDA`. The Deephaven panels on screen 2 and the monitor follow.
2. In the **Desk Controller** read the screens table; try "Move to Screen 1" on `market-data`, then "Swap screens", then "Tile on primary".
3. Click a desk-channel colour (for example red): every view in both windows joins red. Broadcast again; still in sync. Now click *purple* in the blotter's own picker: the Deephaven panels stop following (they are on red); click the desk-channel purple to re-sync.
4. Drag the windows where you like, "Save layout", then "Reset to manifest" and "Restore layout".
5. Close the market-data window and "Re-open from manifest".
6. Unplug or re-arrange a display: the Desk Controller logs *monitor layout changed* and refreshes.

## 6. Browser mode

Without Here Core the Desk Controller cannot manage windows, but you can
still see the sync: open <http://localhost:5174/blotter/>,
<http://localhost:5174/desk/> and <http://localhost:5174/monitor/> in three
browser windows, drag them to different screens and pick a symbol in the
blotter. The Deephaven embed URLs (same as demo 01) work in browser windows
too, and the bridge page at `/bridge/` feeds them.

## 7. Tests

```bash
cd demos/02-multi-window-multi-monitor
npm run typecheck
npm test                       # placement maths (Vitest)
npx playwright install chromium
npm run test:e2e               # Desk Controller against a mocked fin API + FDC3 sync
```

## 8. Troubleshooting

| Problem | What to check |
|---------|---------------|
| Both windows open on one screen although two are connected | Mirroring is on, or the second display is placed above/below the primary; see §4. Use "Move to Screen 2" meanwhile. |
| Port 5174 in use | Demo 02's manifest hard-codes it; free the port or edit `vite.config.ts` and the manifest together. |
| Deephaven panels empty in the market-data window | Deephaven not running or started without anonymous auth; see demo 01's guide. |
| The Desk Controller shows "browser mode" inside Here Core | The view did not get the `fin` API; check the view URL is served by this dev server, not a file URL. |
| Restored layout off-screen | Saved with a monitor that is gone; "Reset to manifest". |
