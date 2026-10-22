/**
 * Pure window-placement maths for a multi-monitor desk. No `fin` calls here
 * so it can be unit-tested; the provider and the Desk Controller feed it
 * `fin.System.getMonitorInfo()` and apply the resulting bounds.
 *
 * Coordinates are OpenFin's device-independent pixels (DIP) in the virtual
 * screen: the primary monitor's top-left is (0,0); a monitor to the left has
 * negative `left`; each monitor may have its own `deviceScaleFactor` (Windows
 * per-monitor DPI, macOS Retina). `availableRect` already excludes the
 * taskbar / menu bar / Dock, which is what we want for window bounds.
 */

export interface EdgeRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The subset of OpenFin's MonitorDetails that placement needs. */
export interface MonitorLike {
  name: string | number;
  deviceId: string | number;
  deviceScaleFactor: number;
  availableRect: EdgeRect;
  monitorRect: EdgeRect;
}

/** The subset of OpenFin's MonitorInfo that placement needs. */
export interface MonitorInfoLike {
  primaryMonitor: MonitorLike;
  nonPrimaryMonitors: MonitorLike[];
}

export interface Screen extends MonitorLike {
  /** 1-based position in left-to-right order; what the UI shows as "Screen N". */
  index: number;
  isPrimary: boolean;
}

export type ScreenPreference = 'primary' | 'secondary' | number;

/** Placement hint carried in a window's `customData`. */
export interface ScreenHint {
  /** Which screen the window wants: the primary one, the first secondary one, or "Screen N" (1-based). */
  screen: ScreenPreference;
  /** When the wanted screen does not exist (single-monitor laptop), tile on the primary instead of overlapping. */
  tileWhenSingle?: 'left' | 'right';
  /** Set to false in saved layouts so restores keep the user's own positions. */
  autoPlace?: boolean;
  /** Gap between the window and the screen edge, in DIP. Default 16. */
  margin?: number;
}

/** Monitors in left-to-right (then top-to-bottom) order, 1-based index, primary flagged. */
export function listScreens(info: MonitorInfoLike): Screen[] {
  const all: Array<MonitorLike & { isPrimary: boolean }> = [
    { ...info.primaryMonitor, isPrimary: true },
    ...info.nonPrimaryMonitors.map((m) => ({ ...m, isPrimary: false })),
  ];
  all.sort((a, b) => a.availableRect.left - b.availableRect.left || a.availableRect.top - b.availableRect.top);
  return all.map((m, i) => ({ ...m, index: i + 1 }));
}

export interface PickedScreen {
  screen: Screen;
  /** True when the requested screen does not exist and the primary was used instead. */
  fallback: boolean;
}

export function pickScreen(info: MonitorInfoLike, preference: ScreenPreference): PickedScreen {
  const screens = listScreens(info);
  const primary = screens.find((s) => s.isPrimary)!;
  if (preference === 'primary') return { screen: primary, fallback: false };
  if (preference === 'secondary') {
    // Prefer the secondary monitor immediately to the right of the primary, else any other one.
    const others = screens.filter((s) => !s.isPrimary);
    const right = others.find((s) => s.index === primary.index + 1);
    const chosen = right ?? others[0];
    return chosen ? { screen: chosen, fallback: false } : { screen: primary, fallback: true };
  }
  const byIndex = screens.find((s) => s.index === preference);
  return byIndex ? { screen: byIndex, fallback: false } : { screen: primary, fallback: true };
}

/** Bounds filling a screen's available area (or its left/right half), inset by `margin`. */
export function boundsOn(screen: MonitorLike, slot: 'full' | 'left' | 'right' = 'full', margin = 16): Bounds {
  const r = screen.availableRect;
  const width = r.right - r.left;
  const height = r.bottom - r.top;
  const half = Math.floor(width / 2);
  const left = slot === 'right' ? r.left + half : r.left;
  const w = slot === 'full' ? width : slot === 'left' ? half : width - half;
  return {
    left: left + margin,
    top: r.top + margin,
    width: Math.max(320, w - 2 * margin),
    height: Math.max(240, height - 2 * margin),
  };
}

/** Where a window with the given hint should go on this desk. */
export function placeWindow(info: MonitorInfoLike, hint: ScreenHint): { bounds: Bounds; screen: Screen; fallback: boolean } {
  const { screen, fallback } = pickScreen(info, hint.screen);
  // On a single-monitor machine every window that carries a tile hint takes
  // its half, so the desk and market-data windows sit side by side instead of
  // on top of each other. The same applies when the wanted screen is missing.
  const singleScreen = listScreens(info).length === 1;
  const slot = (fallback || singleScreen) && hint.tileWhenSingle ? hint.tileWhenSingle : 'full';
  return { bounds: boundsOn(screen, slot, hint.margin), screen, fallback };
}

/** Reads a ScreenHint out of a window's customData, if there is one. */
export function readScreenHint(customData: unknown): ScreenHint | null {
  if (!customData || typeof customData !== 'object') return null;
  const data = customData as Record<string, unknown>;
  const screen = data.screen;
  if (screen !== 'primary' && screen !== 'secondary' && typeof screen !== 'number') return null;
  const hint: ScreenHint = { screen };
  if (data.tileWhenSingle === 'left' || data.tileWhenSingle === 'right') hint.tileWhenSingle = data.tileWhenSingle;
  if (typeof data.autoPlace === 'boolean') hint.autoPlace = data.autoPlace;
  if (typeof data.margin === 'number') hint.margin = data.margin;
  return hint;
}

/** The screen that contains the centre of `bounds`, or the nearest one. */
export function screenOf(info: MonitorInfoLike, bounds: Bounds): Screen {
  const screens = listScreens(info);
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  const inside = screens.find((s) => {
    const r = s.monitorRect;
    return cx >= r.left && cx < r.right && cy >= r.top && cy < r.bottom;
  });
  if (inside) return inside;
  let best = screens[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const s of screens) {
    const r = s.monitorRect;
    const dx = Math.max(r.left - cx, 0, cx - r.right);
    const dy = Math.max(r.top - cy, 0, cy - r.bottom);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = s;
    }
  }
  return best;
}

export function describeScreen(screen: Screen): string {
  const r = screen.monitorRect;
  return `Screen ${screen.index}${screen.isPrimary ? ' (primary)' : ''} · ${r.right - r.left}×${r.bottom - r.top} @${screen.deviceScaleFactor}× at (${r.left}, ${r.top})`;
}
