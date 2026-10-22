/**
 * A small stand-in for the `fin` API, injected with `page.addInitScript`
 * before the Desk Controller loads. It models two platform windows with
 * their views and one or two monitors, records every call the panel makes,
 * and exposes the state as `window.__finMock` for assertions.
 *
 * It is deliberately tiny: just the members the Desk Controller touches.
 * Playwright serialises this function and runs it in the page, so it must
 * not reference anything outside its own body.
 */
export interface FinMockConfig {
  monitors: 1 | 2;
}

export function installFinMock(config: FinMockConfig) {
  type Rect = { top: number; left: number; bottom: number; right: number };
  type Bounds = { left: number; top: number; width: number; height: number };
  type MockWindow = { bounds: Bounds; options: Record<string, unknown>; views: string[] };

  const monitor = (name: string, left: number, width: number, height: number, scale: number) => ({
    name,
    deviceId: name,
    deviceScaleFactor: scale,
    displayDeviceActive: true,
    dpi: { x: 96 * scale, y: 96 * scale },
    monitorRect: { left, top: 0, right: left + width, bottom: height } as Rect,
    availableRect: { left, top: 0, right: left + width, bottom: height - 40 } as Rect,
    monitor: {},
    available: {},
  });
  const primary = monitor('primary', 0, 2560, 1440, 1);
  const nonPrimary = config.monitors === 2 ? [monitor('secondary', 2560, 1920, 1080, 1.25)] : [];
  const monitorInfo = { primaryMonitor: primary, nonPrimaryMonitors: nonPrimary, deviceScaleFactor: 1 };

  const windows: Record<string, MockWindow> = {
    'trading-desk': {
      bounds: { left: 16, top: 16, width: 1200, height: 900 },
      options: { name: 'trading-desk', customData: { role: 'trading-desk', screen: 'primary', tileWhenSingle: 'left' } },
      views: ['order-blotter', 'desk-controller', 'interop-monitor'],
    },
    'market-data': {
      bounds: { left: config.monitors === 2 ? 2576 : 1300, top: 16, width: 1200, height: 900 },
      options: { name: 'market-data', customData: { role: 'market-data', screen: 'secondary', tileWhenSingle: 'right' } },
      views: ['dh-quotes', 'dh-chart', 'dh-trades', 'dh-positions', 'dh-filter-state'],
    },
  };
  const calls: unknown[][] = [];
  const identity = (name: string) => ({ uuid: 'mock-platform', name });

  const wrap = (name: string) => ({
    identity: identity(name),
    getBounds: async () => {
      const b = windows[name]!.bounds;
      return { ...b, right: b.left + b.width, bottom: b.top + b.height, content: b };
    },
    setBounds: async (b: Partial<Bounds>) => {
      Object.assign(windows[name]!.bounds, b);
      calls.push(['setBounds', name, { ...b }]);
    },
    bringToFront: async () => {
      calls.push(['bringToFront', name]);
    },
    focus: async () => {},
    getOptions: async () => windows[name]!.options,
    getCurrentViews: async () => windows[name]!.views.map((v) => ({ identity: identity(v) })),
  });

  const platform = {
    getSnapshot: async () => ({
      windows: Object.values(windows).map((w) => ({
        ...w.options,
        defaultLeft: w.bounds.left,
        defaultTop: w.bounds.top,
        defaultWidth: w.bounds.width,
        defaultHeight: w.bounds.height,
      })),
    }),
    applySnapshot: async (snapshot: { windows: Array<Record<string, unknown>> }, options?: Record<string, unknown>) => {
      calls.push(['applySnapshot', snapshot.windows.map((w) => w.name), options ?? {}]);
    },
    createWindow: async (options: Record<string, unknown>) => {
      const name = String(options.name);
      windows[name] = { bounds: { left: 100, top: 100, width: 800, height: 600 }, options, views: [] };
      calls.push(['createWindow', name]);
      return wrap(name);
    },
  };

  const w = window as unknown as Record<string, unknown>;
  w.fin = {
    me: {
      isOpenFin: true,
      uuid: 'mock-platform',
      name: 'desk-controller',
      identity: identity('desk-controller'),
      interop: {
        joinContextGroup: async (channel: string, target?: { name: string }) => {
          calls.push(['joinContextGroup', channel, target?.name ?? null]);
        },
        getContextGroups: async () => ['green', 'purple', 'orange', 'red', 'pink', 'yellow'].map((id) => ({ id })),
        setContext: async () => {},
        addContextHandler: async () => ({ unsubscribe: async () => {} }),
      },
    },
    System: {
      getVersion: async () => '45.0.0-mock',
      getMonitorInfo: async () => monitorInfo,
      on: async () => {},
      once: async () => {},
    },
    Application: { getCurrentSync: () => ({ getChildWindows: async () => Object.keys(windows).map(wrap) }) },
    Platform: { getCurrentSync: () => platform },
    Window: { getCurrentSync: () => wrap('trading-desk') },
  };
  w.__finMock = {
    calls,
    windows,
    closeWindow: (name: string) => {
      delete windows[name];
    },
  };
}
